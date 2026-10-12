const mode = document.querySelector('meta[name="idun-mode"]')?.getAttribute("content");
export const savedDemo = mode === "showcase";
export const staticWorkspace = mode === "static";
export const inferenceUnavailable = savedDemo || staticWorkspace;
export const publicDemo = savedDemo || staticWorkspace || mode === "public";
