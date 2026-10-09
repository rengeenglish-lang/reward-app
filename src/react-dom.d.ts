// The project does not install @types/react-dom; this covers the one function we use (floating timer pop-out).
declare module 'react-dom' {
  export function createPortal(children: React.ReactNode, container: Element): React.ReactPortal;
}
