async function test() {
  const url = 'https://codeforces.com/api/contest.standings?contestId=2232';
  console.log('Fetching', url);
  const res = await fetch(url);
  console.log('Status:', res.status);
  const json = await res.json();
  console.log('Status in JSON:', json.status);
  if (json.status === 'OK') {
    console.log('Problems count:', json.result.problems.length);
    console.log('Problems:', json.result.problems.map(p => p.index));
  } else {
    console.log('Comment:', json.comment);
  }
}

test();
