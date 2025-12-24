
import https from 'https';

const url = 'https://lh3.googleusercontent.com/a/ACg8ocIP3w1T0bRI93lFFYN6aOh0r7B28zqh5knSxmqZeypCHNABvA=s96-c';

https.get(url, (res) => {
  console.log('StatusCode:', res.statusCode);
  console.log('Headers:', res.headers);
}).on('error', (e) => {
  console.error(e);
});
