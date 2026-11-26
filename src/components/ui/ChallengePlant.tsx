import plantSheet from '../../assets/spritesheet-planta.png';

const FRAME_WIDTH = 355;
const SHEET_HEIGHT = 1184;
const PLANT_CROPS = [
  { top: 976, height: 140 },
  { top: 921, height: 174 },
  { top: 903, height: 194 },
  { top: 818, height: 274 },
  { top: 750, height: 346 },
  { top: 614, height: 478 },
  { top: 461, height: 631 },
  { top: 329, height: 768 },
  { top: 221, height: 870 },
  { top: 96, height: 996 },
];

export const ChallengePlant = ({ completedDays }: { completedDays: number }) => {
  const days = Math.min(21, Math.max(0, Math.round(completedDays)));
  const frame = Math.round((days / 21) * 9);
  const crop = PLANT_CROPS[frame];

  return (
    <div
      role="img"
      aria-label={`Planta da jornada com ${days} dias concluídos`}
      className="w-16 shrink-0 bg-no-repeat sm:w-20"
      style={{
        backgroundImage: `url(${plantSheet})`,
        backgroundSize: '1000% auto',
        backgroundPosition: `${(frame / 9) * 100}% ${(crop.top / (SHEET_HEIGHT - crop.height)) * 100}%`,
        aspectRatio: `${FRAME_WIDTH} / ${crop.height}`,
      }}
    />
  );
};
