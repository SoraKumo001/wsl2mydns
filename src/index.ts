#!/usr/bin/env node
import * as os from "os";import { MyDNSReader } from "./MyDNSReader";

async function setIpAddress(mydnsId:string,mydnsPass:string,ip:string) {
  const reader = new MyDNSReader();
  if(!await reader.getSession(mydnsId, mydnsPass))
    console.error("Login error");
  else{
    console.log("Login successful")
    if(await reader.setDirectIp(ip))
      console.log("[%s] Setting complete",ip);
    else
     console.error("[%s] Setting failure",ip);
  }
};

function getIpAddress(name:string) {
    const interfaces = os.networkInterfaces();

  for (const devName of Object.keys(interfaces)) {
    if(devName !== name)
      continue;
    const device = interfaces[devName];
    for(const info of device){
      if (!info.internal){
          if(info.family === "IPv4")
            return info.address;
      }
    }
  }
  return null;
}

const id = process.argv[0];
const pass = process.argv[1];
console.log(id);
process.exit(0);
if(!id || !pass){
  console.log("wsl2mydns MyDNS-ID MyDNS-PASS");
}else{
  const ipAddress = getIpAddress("eth0");
  if(!ipAddress){
    console.error("IP acquisition error");
  }else{
    setIpAddress(id,pass,ipAddress);
  }

}
