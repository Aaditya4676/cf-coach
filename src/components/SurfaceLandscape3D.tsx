'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';

interface SessionData {
  rating: number;
  minutes: number;
  name: string;
  date: string;
  timestamp: number;
}

interface SurfaceLandscape3DProps {
  data: SessionData[];
}

const SX = 10, SY = 5, SZ = 8;

// Codeforces official rating color palette
function cfRatingColor(rating: number): string {
  if (rating < 1200) return '#808080'; // Newbie — gray
  if (rating < 1400) return '#008000'; // Pupil — green
  if (rating < 1600) return '#03A89E'; // Specialist — cyan
  if (rating < 1900) return '#0000FF'; // Expert — blue
  if (rating < 2100) return '#AA00AA'; // Candidate Master — violet
  if (rating < 2400) return '#FF8C00'; // Master / Intl. Master — orange
  if (rating < 2600) return '#FF3333'; // Grandmaster — red
  if (rating < 3000) return '#CC0000'; // Intl. Grandmaster — dark red
  return '#AA0000';                    // Legendary Grandmaster — deeper red
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

/**
 * Gaussian RBF kernel for smooth interpolation
 */
function gaussianRBF(distSq: number, sigma: number): number {
  return Math.exp(-distSq / (2 * sigma * sigma));
}

/**
 * Smooth surface scene — interpolates solve-time data into a continuous
 * mountain-like surface using Gaussian RBF interpolation.
 */
function SurfaceScene({ data }: { data: SessionData[] }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    pos: THREE.Vector3;
    data: SessionData;
  } | null>(null);

  const { geometry, colorAttribute, pointsData, ratingTicks, dateTicks, timeTicks, contourLines } = useMemo(() => {
    const BUCKET = 100;
    // Group by rating bucket, get average time per (rating, date-bin) cell
    const minDate = Math.min(...data.map(d => d.timestamp));
    const maxDate = Math.max(...data.map(d => d.timestamp));
    const dateSpan = maxDate - minDate || 86400000;
    const ratings = data.map(d => Math.floor(d.rating / BUCKET) * BUCKET);
    const minR = Math.min(...ratings);
    const maxR = Math.max(...ratings);
    const maxMin = Math.max(...data.map(d => d.minutes), 1);

    // Normalized coords for data points
    const dataPoints = data.map(d => {
      const nx = (d.timestamp - minDate) / dateSpan; // 0..1
      const nz = maxR === minR ? 0.5 : (Math.floor(d.rating / BUCKET) * BUCKET - minR) / (maxR - minR); // 0..1
      const ny = d.minutes / maxMin; // 0..1
      return { nx, ny, nz, session: d };
    });

    // Surface resolution
    const RES_X = 50; // date axis
    const RES_Z = 30; // rating axis
    const sigma = 0.12; // smoothing parameter — controls how "smooth" the mountain is

    // Compute surface heights via RBF interpolation
    const heights: number[][] = [];
    for (let iz = 0; iz <= RES_Z; iz++) {
      heights[iz] = [];
      for (let ix = 0; ix <= RES_X; ix++) {
        const px = ix / RES_X;
        const pz = iz / RES_Z;

        let weightedSum = 0;
        let weightSum = 0;
        for (const dp of dataPoints) {
          const dx = px - dp.nx;
          const dz = pz - dp.nz;
          const distSq = dx * dx + dz * dz;
          const w = gaussianRBF(distSq, sigma);
          weightedSum += w * dp.ny;
          weightSum += w;
        }
        heights[iz][ix] = weightSum > 1e-8 ? weightedSum / weightSum : 0;
      }
    }

    // Build geometry: (RES_X+1) * (RES_Z+1) vertices
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    const worldX = (t: number) => t * SX - SX / 2;
    const worldY = (h: number) => h * SY;
    const worldZ = (t: number) => t * SZ - SZ / 2;

    for (let iz = 0; iz <= RES_Z; iz++) {
      for (let ix = 0; ix <= RES_X; ix++) {
        const px = ix / RES_X;
        const pz = iz / RES_Z;
        const h = heights[iz][ix];

        positions.push(worldX(px), worldY(h), worldZ(pz));

        // Color by height: cool (blue) → warm (yellow/orange) → hot (red)
        const color = new THREE.Color();
        if (h < 0.25) {
          color.setHSL(0.6, 0.7, 0.3 + h * 1.5); // deep blue → blue
        } else if (h < 0.5) {
          color.lerpColors(
            new THREE.Color().setHSL(0.55, 0.7, 0.55),
            new THREE.Color().setHSL(0.35, 0.85, 0.5),
            (h - 0.25) / 0.25
          ); // blue → green
        } else if (h < 0.75) {
          color.lerpColors(
            new THREE.Color().setHSL(0.35, 0.85, 0.5),
            new THREE.Color().setHSL(0.12, 0.9, 0.55),
            (h - 0.5) / 0.25
          ); // green → orange/yellow
        } else {
          color.lerpColors(
            new THREE.Color().setHSL(0.12, 0.9, 0.55),
            new THREE.Color().setHSL(0.0, 0.85, 0.5),
            (h - 0.75) / 0.25
          ); // orange → red
        }

        colors.push(color.r, color.g, color.b);
      }
    }

    // Build triangle indices
    for (let iz = 0; iz < RES_Z; iz++) {
      for (let ix = 0; ix < RES_X; ix++) {
        const a = iz * (RES_X + 1) + ix;
        const b = a + 1;
        const c = (iz + 1) * (RES_X + 1) + ix;
        const d = c + 1;
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setIndex(indices);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const colorAttr = geo.getAttribute('color') as THREE.Float32BufferAttribute;

    // Contour lines at various height levels
    const contourLevels = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9];
    const contourLineData: { points: THREE.Vector3[]; height: number }[] = [];

    for (const level of contourLevels) {
      // March along Z slices, find where height crosses level
      for (let iz = 0; iz <= RES_Z; iz++) {
        const linePoints: THREE.Vector3[] = [];
        for (let ix = 0; ix <= RES_X; ix++) {
          const h = heights[iz][ix];
          if (Math.abs(h - level) < 0.05) {
            const px = ix / RES_X;
            const pz = iz / RES_Z;
            linePoints.push(new THREE.Vector3(worldX(px), worldY(level) + 0.02, worldZ(pz)));
          }
        }
        if (linePoints.length > 1) {
          contourLineData.push({ points: linePoints, height: level });
        }
      }
    }

    // Data point markers (spheres on the surface)
    const pointsMapped = data.map(d => {
      const nx = (d.timestamp - minDate) / dateSpan;
      const nz = maxR === minR ? 0.5 : (Math.floor(d.rating / BUCKET) * BUCKET - minR) / (maxR - minR);
      const ny = d.minutes / maxMin;
      return {
        pos: new THREE.Vector3(worldX(nx), worldY(ny) + 0.08, worldZ(nz)),
        color: cfRatingColor(Math.floor(d.rating / BUCKET) * BUCKET),
        data: d,
      };
    });

    // Axis ticks
    const allRatingBuckets = [...new Set(data.map(d => Math.floor(d.rating / BUCKET) * BUCKET))].sort((a, b) => a - b);
    const ratingTicks = allRatingBuckets.map(r => ({
      rating: r,
      z: worldZ(maxR === minR ? 0.5 : (r - minR) / (maxR - minR)),
    }));

    const uniqueDates = [...new Set(data.map(d => new Date(d.timestamp).toISOString().split('T')[0]))].sort();
    const shownDates = uniqueDates.length <= 6 ? uniqueDates
      : [uniqueDates[0], uniqueDates[Math.floor(uniqueDates.length / 2)], uniqueDates[uniqueDates.length - 1]];
    const dateTicks = shownDates.map(ds => ({
      label: new Date(ds).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      x: worldX((new Date(ds).getTime() - minDate) / dateSpan),
    }));

    const timeTicksArr: { label: string; y: number }[] = [];
    const stepSize = maxMin > 60 ? 30 : (maxMin > 30 ? 15 : 5);
    for (let t = stepSize; t <= maxMin; t += stepSize) {
      timeTicksArr.push({ label: `${t}m`, y: worldY(t / maxMin) });
    }

    return {
      geometry: geo,
      colorAttribute: colorAttr,
      pointsData: pointsMapped,
      ratingTicks,
      dateTicks,
      timeTicks: timeTicksArr,
      contourLines: contourLineData,
    };
  }, [data]);

  // Subtle animation — gentle wave on the surface
  const timeRef = useRef(0);
  useFrame((_, delta) => {
    timeRef.current += delta * 0.15;
    if (meshRef.current) {
      meshRef.current.rotation.y = Math.sin(timeRef.current * 0.3) * 0.015;
    }
  });

  return (
    <group>
      {/* Main surface mesh */}
      <mesh ref={meshRef} geometry={geometry}>
        <meshPhongMaterial
          vertexColors
          side={THREE.DoubleSide}
          shininess={60}
          transparent
          opacity={0.88}
          specular={new THREE.Color('#333344')}
        />
      </mesh>

      {/* Wireframe overlay for contour feel */}
      <mesh geometry={geometry}>
        <meshBasicMaterial
          vertexColors
          wireframe
          transparent
          opacity={0.08}
        />
      </mesh>

      {/* Data point spheres */}
      {pointsData.map((p, i) => (
        <mesh
          key={i}
          position={p.pos}
          onPointerEnter={(e) => {
            e.stopPropagation();
            setHoveredPoint({ pos: p.pos, data: p.data });
            document.body.style.cursor = 'pointer';
          }}
          onPointerLeave={(e) => {
            e.stopPropagation();
            setHoveredPoint(null);
            document.body.style.cursor = 'auto';
          }}
        >
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshStandardMaterial
            color={p.color}
            emissive={p.color}
            emissiveIntensity={0.4}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Tooltip */}
      {hoveredPoint && (
        <Html position={hoveredPoint.pos} center zIndexRange={[100, 0]}>
          <div style={{
            background: 'rgba(13,17,23,0.92)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: 'white',
            fontSize: '12px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            transform: 'translateY(-24px)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontWeight: 700, marginBottom: '3px', fontSize: 13 }}>{hoveredPoint.data.name}</div>
            <div style={{ color: '#06b6d4' }}>⏱ Time: {hoveredPoint.data.minutes}m</div>
            <div style={{ color: '#f59e0b' }}>⭐ Rating: {hoveredPoint.data.rating}</div>
            <div style={{ color: '#ffffff60', fontSize: 10, marginTop: 2 }}>
              {new Date(hoveredPoint.data.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </Html>
      )}

      {/* Floor grid */}
      <gridHelper args={[14, 24, 0x1a1a2e, 0x0d0d1a]} position={[0, 0, 0]} />

      {/* Axis labels */}
      <Text position={[0, -0.7, SZ / 2 + 0.9]} fontSize={0.32} color="#06b6d4" anchorX="center">{'← Date →'}</Text>
      <Text position={[-SX / 2 - 1.2, SY / 2, 0]} fontSize={0.32} color="#f59e0b" anchorX="center" rotation={[0, Math.PI / 2, 0]}>{'← Rating →'}</Text>
      <Text position={[-SX / 2 - 0.8, SY / 2, SZ / 2 + 0.6]} fontSize={0.28} color="#10b981" rotation={[0, 0, Math.PI / 2]}>{'Time ↑'}</Text>

      {/* Rating tick labels */}
      {ratingTicks.map(r => (
        <Text key={r.rating} position={[-SX / 2 - 0.5, -0.3, r.z]} fontSize={0.22} color="#ffffff" fillOpacity={0.6} anchorX="right">
          {String(r.rating)}
        </Text>
      ))}

      {/* Date tick labels */}
      {dateTicks.map((d, i) => (
        <Text key={i} position={[d.x, -0.3, SZ / 2 + 0.4]} fontSize={0.18} color="#ffffff" fillOpacity={0.5} anchorX="center">
          {d.label}
        </Text>
      ))}

      {/* Time (Y-axis) tick labels */}
      {timeTicks.map((t, i) => (
        <Text key={i} position={[-SX / 2 - 0.8, t.y, SZ / 2 + 0.4]} fontSize={0.18} color="#10b981" fillOpacity={0.6} anchorX="right">
          {t.label}
        </Text>
      ))}
    </group>
  );
}

/**
 * Height scale legend — color gradient bar showing low → high time values
 */
function HeightLegend() {
  const stops = [
    { color: '#1a3a8a', label: 'Fast' },
    { color: '#1a8a5a', label: '' },
    { color: '#d4a017', label: 'Mid' },
    { color: '#cc3333', label: 'Slow' },
  ];

  return (
    <div style={{
      position: 'absolute', bottom: 12, right: 12,
      background: 'rgba(6,10,20,0.85)', borderRadius: 8, padding: '8px 12px',
      fontSize: 10, color: '#ffffffa0', backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,0.1)', pointerEvents: 'none',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: '#fff', fontSize: 11 }}>Solve Time</div>
      <div style={{
        width: 16, height: 100, borderRadius: 4, position: 'relative',
        background: `linear-gradient(to top, ${stops.map(s => s.color).join(', ')})`,
      }}>
        <span style={{ position: 'absolute', left: 22, bottom: -2, fontSize: 9, whiteSpace: 'nowrap' }}>{stops[0].label}</span>
        <span style={{ position: 'absolute', left: 22, top: '45%', fontSize: 9, whiteSpace: 'nowrap' }}>{stops[2].label}</span>
        <span style={{ position: 'absolute', left: 22, top: -2, fontSize: 9, whiteSpace: 'nowrap' }}>{stops[3].label}</span>
      </div>
    </div>
  );
}

export default function SurfaceLandscape3D({ data }: SurfaceLandscape3DProps) {
  if (!data || data.length < 3) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
        Solve at least 3 timed problems to unlock the 3D surface.
      </div>
    );
  }

  // Build legend from data
  const BUCKET = 100;
  const ratingBuckets = [...new Set(data.map(d => Math.floor(d.rating / BUCKET) * BUCKET))].sort((a, b) => a - b);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
      <Canvas camera={{ position: [12, 8, 10], fov: 38 }} gl={{ antialias: true }} dpr={[1, 2]}>
        <color attach="background" args={['#060a14']} />
        <fog attach="fog" args={['#060a14', 20, 45]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 5]} intensity={1.2} />
        <directionalLight position={[-5, 6, -5]} intensity={0.3} color="#4488ff" />
        <pointLight position={[-6, 4, -4]} intensity={0.5} color="#03A89E" />
        <pointLight position={[6, 4, 4]} intensity={0.3} color="#AA00AA" />
        <Stars radius={50} depth={30} count={500} factor={3} saturation={0.4} fade speed={0.3} />
        <SurfaceScene data={data} />
        <OrbitControls enablePan enableZoom enableRotate autoRotate autoRotateSpeed={0.3} maxPolarAngle={Math.PI / 2.1} minDistance={5} maxDistance={28} />
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
          {ratingBuckets.map(r => (
            <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: cfRatingColor(r) }} />
              <span style={{ color: cfRatingColor(r), fontWeight: 600 }}>
                {r} <span style={{ color: '#ffffff60', fontWeight: 400 }}>({cfRankName(r)})</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Height legend */}
      <HeightLegend />

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
