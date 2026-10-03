ALTER TABLE students DROP CONSTRAINT students_avatar_key_check;
ALTER TABLE students ADD CONSTRAINT students_avatar_key_check CHECK (avatar_key IN (
  'fox','bear','panda','lion','frog','tiger','koala','unicorn','penguin','octopus',
  'dolphin','whale','turtle','butterfly','bee','ladybug','parrot','flamingo','peacock','rabbit',
  'cat','dog','hamster','monkey','elephant','giraffe','zebra','crocodile','dinosaur','dragon',
  'owl','chick','hedgehog','raccoon','squirrel','otter','seal','sloth','llama','deer',
  'horse','mouse','wolf','bird','shell','star','rainbow','rocket','heart','sun',
  'flower','cherry','cupcake','icecream','robot','alien'
));
