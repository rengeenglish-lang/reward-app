// A class mascot is stored as text. Emoji mascots are the emoji itself; picture mascots are "img:<id>".
export const mascotPictures = [
  { id: 'img:flame', src: '/mascots/flame.webp', name: 'Flame' },
  { id: 'img:bomb', src: '/mascots/bomb.webp', name: 'Bomb' },
  { id: 'img:patato', src: '/mascots/patato.webp', name: 'Patato' },
  { id: 'img:babapiro', src: '/mascots/babapiro.webp', name: 'Babapiro' },
  { id: 'img:mahmut', src: '/mascots/mahmut.webp', name: 'Mahmut' },
  { id: 'img:banana', src: '/mascots/banana.webp', name: 'Banana' },
  { id: 'img:deniz', src: '/mascots/deniz.svg', name: 'Deniz' },
  { id: 'img:star', src: '/mascots/star.webp', name: 'Star' },
  { id: 'img:proud', src: '/mascots/proud.webp', name: 'Proud' },
  { id: 'img:great-job', src: '/mascots/great-job.webp', name: 'Great Job' },
  { id: 'img:great-effort', src: '/mascots/great-effort.webp', name: 'Great Effort' },
  { id: 'img:angel', src: '/mascots/angel.webp', name: 'Angel' },
  { id: 'img:happy-teacher', src: '/mascots/happy-teacher.webp', name: 'Happy Teacher' },
  { id: 'img:do-your-best', src: '/mascots/do-your-best.webp', name: 'Do Your Best' },
  { id: 'img:do-better', src: '/mascots/do-better.webp', name: 'Do Better' },
  { id: 'img:check-answers', src: '/mascots/check-answers.webp', name: 'Check Answers' },
  { id: 'img:homework-missing', src: '/mascots/homework-missing.webp', name: 'Where Is It?' },
  { id: 'img:no-homework', src: '/mascots/no-homework.webp', name: 'No Homework' },
  { id: 'img:unfinished-work', src: '/mascots/unfinished-work.webp', name: 'Unfinished' },
  { id: 'img:goose', src: '/mascots/goose.webp', name: 'Goose' },
  { id: 'img:goose-sketch', src: '/mascots/goose-sketch.webp', name: 'Goose Sketch' },
  { id: 'img:bird', src: '/mascots/bird.webp', name: 'Bird' },
  { id: 'img:turtle', src: '/mascots/turtle.webp', name: 'Turtle' },
  { id: 'img:jellyfish', src: '/mascots/jellyfish.webp', name: 'Jellyfish' },
  { id: 'img:seastar', src: '/mascots/seastar.webp', name: 'Seastar' },
] as const;

export default function MascotFace({ value }: { value: string }) {
  const picture = mascotPictures.find((item) => item.id === value);
  // eslint-disable-next-line @next/next/no-img-element
  return picture ? <img className="mascot-img" src={picture.src} alt="" width={96} height={96} /> : <>{value}</>;
}
