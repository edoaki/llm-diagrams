import fs from 'node:fs/promises';
import vm from 'node:vm';
export async function validateData(data){
 const runtime=await fs.readFile(new URL('../shared/diagram-data.js',import.meta.url),'utf8');
 const sandbox={window:{},document:{querySelector:()=>({textContent:JSON.stringify(data)})},Intl};
 vm.runInNewContext(runtime,sandbox,{timeout:1000});
 return data;
}
