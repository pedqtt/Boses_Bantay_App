// Use the exact offline QR encoder already installed with Expo CLI.
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const root=path.resolve(process.argv[2]);
const expoRequire=createRequire(require.resolve('@expo/cli',{paths:[root]}));
const {text}=JSON.parse(fs.readFileSync(0,'utf8'));
if(typeof text!=='string'||!/^exps?:\/\//.test(text)||text.length>2000)throw Error('Invalid Expo link');
const modules=expoRequire('toqr').toQR(text);
process.stdout.write(JSON.stringify({size:Math.sqrt(modules.length),modules:Array.from(modules)}));
