import { ZipArchive } from "archiver";
const z: any = new ZipArchive({ zlib: { level: 6 } });
console.log("ZipArchive constructs:", typeof z.append === "function", "| pipe:", typeof z.pipe === "function");
