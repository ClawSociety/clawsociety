export const metadata = {
  title: 'Agent Royale',
  description: 'AI-powered battle royale — a Claw Society game on Base',
};

export default function RoyaleLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col">{children}</div>;
}
