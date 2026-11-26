// ponte entre a tela e o processo principal
import { contextBridge, ipcRenderer } from "electron";

// a tela so ganha uma funcao chamada api chamar e mais nada do node
contextBridge.exposeInMainWorld("api", {
  chamar: (canal: string, dados?: unknown) => ipcRenderer.invoke(canal, dados),
});
