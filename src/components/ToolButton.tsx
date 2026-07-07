import { ReactNode } from "react";

interface ToolButtonProps {
  title: string;
  children: ReactNode;
  onClick: () => void;
}

export function ToolButton({ title, children, onClick }: ToolButtonProps) {
  return <button className="icon-button" type="button" title={title} onClick={onClick}>{children}<span className="sr-only">{title}</span></button>;
}
