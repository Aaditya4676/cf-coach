'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Stars, Line, Html } from '@react-three/drei';
import * as THREE from 'three';

interface SessionData {
  rating: number;
  minutes: number;
  name: string;
  date: string;
  timestamp: number;
}

interface SpeedLandscape3DProps {
  data: SessionData[];
}

const BUCKET = 100; // changed from 200 to 100
const SX = 10, SY = 5, SZ = 8;

// Codeforces official rating color palette
function cfRatingColor(rating: number): THREE.Color {
  if (rating < 1200) return new THREE.Color('#808080'); // Newbie — gray
  if (rating < 1400) return new THREE.Color('#008000'); // Pupil — green
  if (rating < 1600) return new THREE.Color('#03A89E'); // Specialist — cyan
  if (rating < 1900) return new THREE.Color('#0000FF'); // Expert — blue
  if (rating < 2100) return new THREE.Color('#AA00AA'); // Candidate Master — violet
  if (rating < 2400) return new THREE.Color('#FF8C00'); // Master / Intl. Master — orange
  if (rating < 2600) return new THREE.Color('#FF3333'); // Grandmaster — red
  if (rating < 3000) return new THREE.Color('#CC0000'); // Intl. Grandmaster — dark red
  return new THREE.Color('#AA0000');                    // Legendary Grandmaster — deeper red
}

function cfRankName(rating: number): string {
  if (rating < 1200) return 'Newbie';
  if (rating < 1400) return 'Pupil';
  if (rating < 1600) return 'Specialist';
  if (rating < 1900) return 'Expert';
  if (rating < 2100) return 'Cand. Master';
  if (rating < 2300) return 'Master';
  if (rating < 2400) return 'Intl. Master';
  if (rating < 2600) return 'Grandmaster';
  if (rating < 3000) return 'Intl. GM';
  return 'Legendary GM';
}

// Keep old signature for compatibility but forward to CF palette
function ratingColor(rating: number, _minR?: number, _maxR?: number): THREE.Color {
  return cfRatingColor(rating);
}

function Scene({ data }: { data: SessionData[] }) {
  const sphereRef = useRef<THREE.InstancedMesh>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const { ribbons, refLines, pointsData, allRatings, dateLabels, timeLabels, minR, maxR } = useMemo(() => {
    // Group by rating bucket
    const groups = new Map<number, SessionData[]>();
    data.forEach(d => {
      const b = Math.floor(d.rating / BUCKET) * BUCKET;
      if (!groups.has(b)) groups.set(b, []);
      groups.get(b)!.push(d);
    });
    groups.forEach(g => g.sort((a, b) => a.timestamp - b.timestamp));

    const allRatings = Array.from(groups.keys()).sort((a, b) => a - b);
    const minR = allRatings[0], maxR = allRatings[allRatings.length - 1];
    const minDate = Math.min(...data.map(d => d.timestamp));
    const maxDate = Math.max(...data.map(d => d.timestamp));
    const maxMin = Math.max(...data.map(d => d.minutes), 1);
    const dateSpan = maxDate - minDate || 86400000;

    const toX = (ts: number) => ((ts - minDate) / dateSpan) * SX - SX / 2;
    const toY = (m: number) => (m / maxMin) * SY;
    const toZ = (r: number) => {
      const t = maxR === minR ? 0.5 : (r - minR) / (maxR - minR);
      return t * SZ - SZ / 2;
    };

    // Build ribbons via ExtrudeGeometry — each spans full date range
    const ribbons: { geo: THREE.BufferGeometry; z: number; color: THREE.Color; rating: number }[] = [];
    const STEPS = 40; // number of X-axis sample points for smooth curves
    const xLeft = -SX / 2, xRight = SX / 2;

    allRatings.forEach(rating => {
      const sessions = groups.get(rating)!;
      if (!sessions.length) return;
      const color = cfRatingColor(rating);
      const z = toZ(rating);

      // Build sorted known points: { x, y } from actual solves
      const known = sessions.map(s => ({ x: toX(s.timestamp), y: toY(s.minutes) }));

      // Sample the ribbon profile across the full date range
      const sampledPts: { x: number; y: number }[] = [];
      for (let step = 0; step <= STEPS; step++) {
        const x = xLeft + (step / STEPS) * (xRight - xLeft);

        let y: number;
        if (x <= known[0].x) {
          // Before first data point — hold first value
          y = known[0].y;
        } else if (x >= known[known.length - 1].x) {
          // After last data point — hold last value
          y = known[known.length - 1].y;
        } else {
          // Between data points — linear interpolation
          let lo = known[0], hi = known[known.length - 1];
          for (let i = 0; i < known.length - 1; i++) {
            if (x >= known[i].x && x <= known[i + 1].x) {
              lo = known[i]; hi = known[i + 1]; break;
            }
          }
          const t = (hi.x === lo.x) ? 0 : (x - lo.x) / (hi.x - lo.x);
          y = lo.y + t * (hi.y - lo.y);
        }
        sampledPts.push({ x, y });
      }

      const shape = new THREE.Shape();
      shape.moveTo(sampledPts[0].x, 0);
      sampledPts.forEach(p => shape.lineTo(p.x, p.y));
      shape.lineTo(sampledPts[sampledPts.length - 1].x, 0);
      shape.closePath();

      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 });
      ribbons.push({ geo, z: z - 0.125, color, rating });
    });

    // Avg & Median reference lines per rating
    const refLines: { z: number; avgY: number; medY: number; color: THREE.Color; rating: number }[] = [];
    allRatings.forEach(rating => {
      const sessions = groups.get(rating)!;
      if (sessions.length < 2) return;
      const mins = sessions.map(s => s.minutes);
      const avg = mins.reduce((a, b) => a + b, 0) / mins.length;
      const sorted = [...mins].sort((a, b) => a - b);
      const med = sorted[Math.floor(sorted.length / 2)];
      refLines.push({
        z: toZ(rating),
        avgY: toY(avg),
        medY: toY(med),
        color: cfRatingColor(rating),
        rating,
      });
    });

    // Spheres data (no InstancedMesh so we can easily add onPointerOver)
    // Actually InstancedMesh with Raycaster is a bit annoying for simple tooltips, 
    // but we can use normal meshes since it's < 1000 items, or just use instanced mesh with instanceId
    const pointsData = data.map(d => {
      const b = Math.floor(d.rating / BUCKET) * BUCKET;
      return {
        pos: new THREE.Vector3(toX(d.timestamp), toY(d.minutes), toZ(b)),
        color: cfRatingColor(b),
        data: d,
      };
    });

    // Date labels
    const uniqueDates = [...new Set(data.map(d => new Date(d.timestamp).toISOString().split('T')[0]))].sort();
    const shown = uniqueDates.length <= 6 ? uniqueDates
      : [uniqueDates[0], uniqueDates[Math.floor(uniqueDates.length / 2)], uniqueDates[uniqueDates.length - 1]];
    const dateLabels = shown.map(ds => ({
      label: new Date(ds).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      x: toX(new Date(ds).getTime()),
    }));

    // Time (Y-axis) labels
    const timeLabels = [];
    const stepSize = maxMin > 60 ? 30 : (maxMin > 30 ? 15 : 5);
    for (let t = 0; t <= maxMin; t += stepSize) {
      if (t > 0) {
        timeLabels.push({
          label: `${t}m`,
          y: toY(t),
        });
      }
    }

    return { ribbons, refLines, pointsData, allRatings: allRatings.map(r => ({ rating: r, z: toZ(r) })), dateLabels, timeLabels, minR, maxR };
  }, [data]);

  // Animate instanced spheres
  useFrame(() => {
    if (!sphereRef.current) return;
    const dummy = new THREE.Object3D();
    pointsData.forEach((p, i) => {
      dummy.position.copy(p.pos);
      // scale up slightly if hovered
      const scale = hoveredIdx === i ? 1.5 : 1;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      sphereRef.current!.setMatrixAt(i, dummy.matrix);
      sphereRef.current!.setColorAt(i, p.color);
    });
    sphereRef.current.instanceMatrix.needsUpdate = true;
    if (sphereRef.current.instanceColor) sphereRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      {/* Ribbons — one per difficulty band */}
      {ribbons.map((r, i) => (
        <mesh key={i} geometry={r.geo} position={[0, 0, r.z]}>
          <meshPhongMaterial
            color={r.color}
            transparent
            opacity={0.65}
            side={THREE.DoubleSide}
            shininess={90}
            emissive={r.color}
            emissiveIntensity={0.15}
          />
        </mesh>
      ))}

      {/* Glowing data-point spheres */}
      <instancedMesh 
        ref={sphereRef} 
        args={[undefined, undefined, pointsData.length]}
        onPointerMove={(e) => {
          e.stopPropagation();
          if (e.instanceId !== undefined) {
            setHoveredIdx(e.instanceId);
            document.body.style.cursor = 'pointer';
          }
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHoveredIdx(null);
          document.body.style.cursor = 'auto';
        }}
      >
        <sphereGeometry args={[0.13, 14, 14]} />
        <meshStandardMaterial vertexColors toneMapped={false} emissive="#ffffff" emissiveIntensity={0.3} />
      </instancedMesh>

      {/* Tooltip for hovered point */}
      {hoveredIdx !== null && (
        <Html position={pointsData[hoveredIdx].pos} center zIndexRange={[100, 0]}>
          <div style={{
            background: 'rgba(13,17,23,0.9)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '6px',
            padding: '6px 10px',
            color: 'white',
            fontSize: '12px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            transform: 'translateY(-20px)'
          }}>
            <div style={{ fontWeight: 700, marginBottom: '2px' }}>{pointsData[hoveredIdx].data.name}</div>
            <div style={{ color: '#06b6d4' }}>Time: {pointsData[hoveredIdx].data.minutes}m</div>
            <div style={{ color: '#f59e0b' }}>Rating: {pointsData[hoveredIdx].data.rating}</div>
          </div>
        </Html>
      )}

      {/* Avg & Median reference lines per rating */}
      {refLines.map((rl, i) => (
        <group key={`ref-${i}`}>
          {/* Average — dashed */}
          <Line
            points={[[-SX / 2, rl.avgY, rl.z], [SX / 2, rl.avgY, rl.z]]}
            color="#f59e0b"
            lineWidth={1.2}
            dashed
            dashSize={0.3}
            gapSize={0.15}
          />
          <Text position={[SX / 2 + 0.3, rl.avgY, rl.z]} fontSize={0.15} color="#f59e0b" fillOpacity={0.7} anchorX="left">
            avg
          </Text>
          {/* Median — solid */}
          <Line
            points={[[-SX / 2, rl.medY, rl.z], [SX / 2, rl.medY, rl.z]]}
            color="#06b6d4"
            lineWidth={1.2}
          />
          <Text position={[SX / 2 + 0.3, rl.medY, rl.z]} fontSize={0.15} color="#06b6d4" fillOpacity={0.7} anchorX="left">
            med
          </Text>
        </group>
      ))}

      {/* Floor grid */}
      <gridHelper args={[14, 24, 0x1a1a2e, 0x0d0d1a]} position={[0, 0, 0]} />

      {/* Axis labels */}
      <Text position={[0, -0.7, SZ / 2 + 0.9]} fontSize={0.32} color="#06b6d4" anchorX="center">{'← Date →'}</Text>
      <Text position={[-SX / 2 - 1.2, SY / 2, 0]} fontSize={0.32} color="#f59e0b" anchorX="center" rotation={[0, Math.PI / 2, 0]}>{'← Rating →'}</Text>
      <Text position={[-SX / 2 - 0.8, SY / 2, SZ / 2 + 0.6]} fontSize={0.28} color="#10b981" rotation={[0, 0, Math.PI / 2]}>{'Time ↑'}</Text>

      {/* Rating tick labels */}
      {allRatings.map(r => (
        <Text key={r.rating} position={[-SX / 2 - 0.5, -0.3, r.z]} fontSize={0.22} color="#ffffff" fillOpacity={0.6} anchorX="right">
          {String(r.rating)}
        </Text>
      ))}

      {/* Date tick labels */}
      {dateLabels.map((d, i) => (
        <Text key={i} position={[d.x, -0.3, SZ / 2 + 0.4]} fontSize={0.18} color="#ffffff" fillOpacity={0.5} anchorX="center">
          {d.label}
        </Text>
      ))}
      
      {/* Time (Y-axis) tick labels */}
      {timeLabels.map((t, i) => (
        <Text key={i} position={[-SX / 2 - 0.8, t.y, SZ / 2 + 0.4]} fontSize={0.18} color="#10b981" fillOpacity={0.6} anchorX="right">
          {t.label}
        </Text>
      ))}
    </group>
  );
}

export default function SpeedLandscape3D({ data }: SpeedLandscape3DProps) {
  if (!data || data.length < 3) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
        Solve at least 3 timed problems to unlock the 3D landscape.
      </div>
    );
  }

  // Build legend from data
  const ratingBuckets = [...new Set(data.map(d => Math.floor(d.rating / BUCKET) * BUCKET))].sort((a, b) => a - b);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
      <Canvas camera={{ position: [10, 7, 10], fov: 40 }} gl={{ antialias: true }} dpr={[1, 2]}>
        <color attach="background" args={['#060a14']} />
        <fog attach="fog" args={['#060a14', 18, 40]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 8, 5]} intensity={1} />
        <pointLight position={[-6, 4, -4]} intensity={0.6} color="#03A89E" />
        <pointLight position={[6, 4, 4]} intensity={0.4} color="#AA00AA" />
        <Stars radius={50} depth={30} count={600} factor={3} saturation={0.5} fade speed={0.4} />
        <Scene data={data} />
        <OrbitControls enablePan enableZoom enableRotate autoRotate autoRotateSpeed={0.4} maxPolarAngle={Math.PI / 2.1} minDistance={5} maxDistance={25} />
      </Canvas>

      {/* Rating legend — Codeforces palette */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12,
        background: 'rgba(6,10,20,0.85)', borderRadius: 8, padding: '8px 12px',
        fontSize: 11, color: '#ffffffa0', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.1)', pointerEvents: 'none',
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: '#fff', fontSize: 12 }}>Rating</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {ratingBuckets.map(r => {
            const c = cfRatingColor(r);
            return (
              <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: `#${c.getHexString()}` }} />
                <span style={{ color: `#${c.getHexString()}`, fontWeight: 600 }}>
                  {r} <span style={{ color: '#ffffff60', fontWeight: 400 }}>({cfRankName(r)})</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{
        position: 'absolute', top: 12, right: 12,
        background: 'rgba(6,10,20,0.7)', borderRadius: 6, padding: '4px 10px',
        fontSize: 10, color: '#ffffff50', pointerEvents: 'none',
      }}>
        Drag to rotate · Scroll to zoom
      </div>
    </div>
  );
}
