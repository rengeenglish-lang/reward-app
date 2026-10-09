// A class mascot is stored as text. Emoji mascots are the emoji itself; picture mascots are "img:<id>".
export const mascotPictures = [
  { id: 'img:flame', src: '/mascots/flame.webp', name: 'Flame' },
  { id: 'img:bomb', src: '/mascots/bomb.webp', name: 'Bomb' },
  { id: 'img:patato', src: '/mascots/patato.webp', name: 'Patato' },
  { id: 'img:babapiro', src: '/mascots/babapiro.webp', name: 'Babapiro' },
  { id: 'img:mahmut', src: '/mascots/mahmut.webp', name: 'Mahmut' },
  { id: 'img:banana', src: '/mascots/banana.webp', name: 'Banana' },
  { id: 'img:deniz', src: '/mascots/deniz.svg', name: 'Deniz' },
] as const;

export default function MascotFace({ value }: { value: string }) {
  const picture = mascotPictures.find((item) => item.id === value);
  // eslint-disable-next-line @next/next/no-img-element
  return picture ? <img className="mascot-img" src={picture.src} alt="" width={96} height={96} /> : <>{value}</>;
}
