import { contextBridge, ipcRenderer } from "electron";

// O preload é a "ponte" entre a tela e o processo principal.
// Só expõe UMA função (chamar). A tela não recebe acesso ao Node nem ao ipcRenderer inteiro.
contextBridge.exposeInMainWorld("api", {
  chamar: (canal: string, dados?: unknown) => ipcRenderer.invoke(canal, dados),
});
