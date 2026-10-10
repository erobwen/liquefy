import { vault, category, file, folder } from "./model.js";
import credits from "./credits.json";

/**
 * What the file system starts with: pictures - photos, drawings,
 * paintings, prints - of animals and vehicles, from Wikimedia Commons, each
 * with its author and license (credits.json, shown with the file).
 *
 * Tagged the way people tag: mostly well, sometimes not quite - a robin
 * that's only an Animal, a husky that isn't one at all - so some folders
 * have files none of their sub-folders shows. Those are what "Show
 * unsorted" finds.
 */

const images = import.meta.glob("./images/*.jpg", { eager: true, query: "?url", import: "default" });

// Subjects
const Animal = category("Animal", "pets");
const Cat = category("Cat");
const Dog = category("Dog");
const Horse = category("Horse");
const Bird = category("Bird");
const Vehicle = category("Vehicle", "commute");
const Car = category("Car");
const Boat = category("Boat");
const Carriage = category("Carriage");
// Kinds of picture
const Photo = category("Photo", "photo_camera");
const Drawing = category("Drawing", "draw");
const Sketch = category("Sketch");
const Painting = category("Painting", "palette");
const Watercolor = category("Watercolor");
const Engraving = category("Engraving");
const Poster = category("Poster");
// Marks
const Favorite = category("Favorite", "favorite");

vault.categories = [Animal, Cat, Dog, Horse, Bird, Vehicle, Car, Boat, Carriage, Photo, Drawing, Sketch, Painting, Watercolor, Engraving, Poster, Favorite];

vault.root = folder(
  { name: "All files", icon: "photo_library", open: true },
  folder({ category: Favorite, icon: "favorite" }),
  folder(
    { category: Animal, name: "Animals", icon: "pets", open: true },
    folder({ category: Cat, name: "Cats" }, folder({ category: Dog, name: "With dogs" })),
    folder({ category: Dog, name: "Dogs" }),
    folder({ category: Horse, name: "Horses" }),
    folder({ category: Bird, name: "Birds" }),
  ),
  folder(
    { category: Vehicle, name: "Vehicles", icon: "commute" },
    folder({ category: Car, name: "Cars" }),
    folder({ category: Boat, name: "Boats" }),
    folder({ category: Carriage, name: "Carriages" }),
  ),
  folder({ category: Photo, name: "Photos", icon: "photo_camera" }),
  folder(
    { category: Drawing, name: "Drawings", icon: "draw" },
    folder({ category: Sketch, name: "Sketches" }),
  ),
  folder(
    { category: Painting, name: "Paintings", icon: "palette" },
    folder({ category: Watercolor, name: "Watercolors" }),
  ),
);

// [image, name, date, categories]
const files = [
  // Photos of animals
  ["cat-in-snow", "Cat in the snow", "2010-02-09", [Animal, Cat, Photo]],
  ["cat-face", "Cat face", "2018-10-07", [Animal, Cat, Photo, Favorite]],
  ["calico-cat", "Calico cat in Assisi", "2025-10-07", [Animal, Cat, Photo]],
  ["two-tabby-cats", "Two tabby cats", "2019-01-18", [Animal, Cat, Photo]],
  ["labrador", "Labrador", "2019-07-20", [Animal, Dog, Photo]],
  ["westie", "Westie", "2023-05-29", [Animal, Dog, Photo]],
  ["curly-poodle", "Curly poodle", "2024-02-07", [Animal, Dog, Photo]],
  ["golden-retriever", "Golden retriever", "2022-12-17", [Animal, Dog, Photo, Favorite]],
  ["haflinger-foal", "Haflinger foal", "2008-05-25", [Animal, Horse, Photo]],
  ["horse-in-the-mountains", "Horse in the mountains", "2019-12-31", [Animal, Photo]],
  ["macaw", "Blue and yellow macaw", "2009-07-15", [Animal, Bird, Photo, Favorite]],
  ["robin", "Robin", "2011-05-28", [Animal, Photo]],
  ["hanging-parrot", "Hanging parrot", "2025-08-04", [Animal, Bird, Photo]],
  ["socks-and-buddy", "Socks and Buddy", "1998-06-16", [Animal, Cat, Dog, Photo]],
  // Animals and vehicles
  ["horse-drawn-sleighs", "Horse-drawn sleighs", "2012-12-22", [Animal, Horse, Vehicle, Carriage, Photo]],
  ["dog-and-pony", "Dog and pony, 1908", "1908-06-01", [Animal, Dog, Horse, Vehicle, Carriage, Photo]],
  ["white-carriage", "White carriage in Dublin", "2010-09-12", [Animal, Horse, Vehicle, Carriage, Photo]],
  ["dog-in-a-car", "Dog in a car", "2015-12-14", [Animal, Dog, Vehicle, Car, Photo]],
  ["husky-in-the-window", "Husky in the window", "2023-09-11", [Dog, Car]],
  ["barge-cat", "Barge cat on the prowl", "2009-08-18", [Animal, Cat, Vehicle, Boat, Photo]],
  ["cat-on-a-canoe", "Cat on a fishing canoe", "2013-05-12", [Animal, Cat, Boat, Photo]],
  ["stray-cat-on-a-boat", "Stray cat on a boat", "2010-11-20", [Animal, Cat, Vehicle, Boat, Photo]],
  // Photos of vehicles
  ["catboat", "Catboat", "2007-07-07", [Vehicle, Boat, Photo]],
  ["moonbeam", "Moonbeam", "2008-07-16", [Vehicle, Boat, Photo]],
  ["royal-clipper", "Royal Clipper", "2018-04-30", [Vehicle, Boat, Photo, Favorite]],
  ["sunset-sail", "Sunset sail", "2022-10-29", [Vehicle, Photo]],
  ["sailing-ship-norfolk", "Sailing ship Norfolk", "1890-01-01", [Vehicle, Boat, Photo]],
  ["chevrolet-fleetline", "Chevrolet Fleetline", "2008-07-20", [Vehicle, Car, Photo]],
  ["opel-rekord", "Opel Rekord", "2016-09-03", [Vehicle, Car, Photo]],
  ["buick-special", "Buick Special", "2019-06-20", [Vehicle, Car, Photo, Favorite]],
  ["monopoletta", "Monopoletta racer", "2022-08-06", [Vehicle, Car, Photo]],
  ["peel-p50", "Peel P50", "2025-09-06", [Vehicle, Photo]],
  // Drawings
  ["wain-cats", "Cats at play", "1900-01-01", [Animal, Cat, Drawing]],
  ["wain-cat-with-lute", "Cat with a lute", "1905-01-01", [Animal, Cat, Drawing, Favorite]],
  ["wain-love-letters", "Love letters of a cat", "1901-03-27", [Animal, Cat, Drawing]],
  ["wain-persian-cat", "Persian cat", "1901-11-06", [Animal, Cat, Drawing]],
  ["steinlen-cat", "Cat", "1900-01-01", [Animal, Cat, Drawing]],
  ["steinlen-cat-and-goldfish", "Cat and goldfish", "1900-01-01", [Animal, Cat, Drawing]],
  ["steinlen-it-burns", "It burns!", "1898-01-01", [Animal, Cat, Drawing, Sketch]],
  ["steinlen-cat-walking", "Cat walking", "1905-01-01", [Cat, Drawing]],
  ["redon-horse-sketch", "Sketch of a horse's head", "1894-01-01", [Animal, Horse, Drawing, Sketch]],
  ["bevan-horse-sketch", "Sketch of a horse", "1900-01-01", [Animal, Drawing]],
  // Prints
  ["wolf-dogs", "Wolf dogs of the Abruzzi", "1833-05-25", [Animal, Dog, Engraving]],
  ["greyhound", "Greyhound", "1831-01-01", [Animal, Dog, Engraving]],
  ["sea-monsters", "Sea monsters attacking a ship", "1684-01-01", [Vehicle, Boat, Engraving]],
  ["audubon-eagle", "Bird of Washington", "1830-01-01", [Animal, Bird, Engraving]],
  ["audubon-red-bird", "Summer red bird", "1830-01-01", [Animal, Bird, Engraving]],
  ["speedway-poster", "Speedway poster, 1909", "1909-01-01", [Vehicle, Car, Poster]],
  ["speedway-scan", "Scan 0042", "1909-01-01", []],
  // Paintings
  ["stubbs-horse-frightened", "Horse frightened by a lion", "1763-01-01", [Animal, Horse, Painting]],
  ["stubbs-horse-in-the-shade", "Horse in the shade of a wood", "1780-01-01", [Animal, Horse, Painting]],
  ["stubbs-horse-attacked", "Horse attacked by a lion", "1769-01-01", [Animal, Horse, Painting, Favorite]],
  ["homer-blue-boat", "The blue boat", "1892-01-01", [Vehicle, Boat, Painting, Watercolor]],
  ["homer-fishing-boats", "Fishing boats, Key West", "1903-12-01", [Vehicle, Boat, Painting, Watercolor]],
  ["homer-hunting-dogs", "Hunting dogs in a boat", "1889-01-01", [Animal, Dog, Vehicle, Boat, Painting, Watercolor, Favorite]],
  ["velazquez-dog-and-cat", "Dog and cat", "1655-01-01", [Animal, Cat, Dog, Painting]],
  ["heyer-dog-and-cats", "Dog and cats", "1920-01-01", [Animal, Cat, Dog, Painting]],
  ["heyer-dog-and-cat", "Dog and cat, again", "1925-01-01", [Animal, Cat, Dog, Painting]],
  ["girl-in-red-dress", "Girl in red dress with cat and dog", "1832-01-01", [Animal, Cat, Dog, Painting]],
  ["coninck-cat-and-dog", "A cat and a dog fighting over fowl", "1680-01-01", [Animal, Painting]],
  ["durer-young-hare", "Young hare", "1502-01-01", [Animal, Painting, Watercolor, Favorite]],
];

vault.files = files.map(([slug, name, date, categories]) => file({
  slug, name, date, categories,
  image: images["./images/" + slug + ".jpg"],
  credit: credits[slug],
}));
