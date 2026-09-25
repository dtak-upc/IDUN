const mode = document.querySelector('meta[name="idun-mode"]')?.getAttribute("content");
export const savedDemo = mode === "showcase";
export const publicDemo = savedDemo || mode === "public";
