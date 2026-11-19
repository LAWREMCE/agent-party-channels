import tls from 'node:tls';
import {createInterface} from 'node:readline';
import {once} from 'node:events';

export async function openPop3(config){
 const socket=tls.connect({host:config.host,port:config.port,servername:config.host,rejectUnauthorized:true});
 socket.on('error',()=>{}); // Pending reads finish on close; never emit raw socket errors or credentials to logs.
 socket.setTimeout(20000,()=>socket.destroy(Error('POP3 timeout')));
 socket.setEncoding('latin1');
 const lines=createInterface({input:socket,crlfDelay:Infinity})[Symbol.asyncIterator]();
 // Consume the greeting through the same iterator; no command or credential is logged.
 const line=async()=>{const r=await lines.next();if(r.done)throw Error('POP3 disconnected');return r.value};
 try{
  await once(socket,'secureConnect');
  if(!(await line()).startsWith('+OK'))throw Error('POP3 greeting rejected');
  const command=async(text,multiline=false)=>{
   if(/[\r\n]/.test(text))throw Error('Invalid POP3 command');
   socket.write(text+'\r\n','latin1');
   const header=await line();if(!header.startsWith('+OK'))throw Error('POP3 command rejected');
   if(!multiline)return header;
   const result=[];let bytes=0;
   for(;;){const value=await line();if(value==='.')break;bytes+=value.length+2;if(bytes>25*1024*1024)throw Error('POP3 message too large');result.push(value.startsWith('..')?value.slice(1):value)}
   return result;
  };
  await command('USER '+config.username);await command('PASS '+config.password);
  return {command,close:async()=>{try{await command('QUIT')}finally{socket.destroy()}},destroy:()=>socket.destroy()};
 }catch(e){socket.destroy();throw e;}
}
