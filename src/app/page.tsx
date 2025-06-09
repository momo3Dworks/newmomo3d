import GameContainer from "@/components/game/GameContainer";

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <GameContainer />
    </main>
  );
}
