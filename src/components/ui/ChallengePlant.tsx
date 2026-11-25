import plantSheet from '../../assets/spritesheet-planta.png';

// 1 linha x 10 quadros: semente no dia 0, planta florida no dia 21.
export const ChallengePlant = ({ completedDays }: { completedDays: number }) => {
  const days = Math.min(21, Math.max(0, Math.round(completedDays)));
  const frame = Math.round((days / 21) * 9);

  return (
    <div
      role="img"
      aria-label={`Planta da jornada com ${days} dias concluídos`}
      className="w-16 shrink-0 bg-no-repeat sm:w-20"
      style={{
        backgroundImage: `url(${plantSheet})`,
        backgroundSize: '1000% 100%',
        backgroundPosition: `${(frame / 9) * 100}% 0%`,
        aspectRatio: '3134 / 13440',
      }}
    />
  );
};
