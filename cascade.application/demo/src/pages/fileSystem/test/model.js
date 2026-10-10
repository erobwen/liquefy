import assert from "assert";
import {
  vault, category, file, folder, folderPath, folderForPath, filesIn, splitBySubFolders, sorted,
  addCategory, removeCategory, fileInto, addFolder, removeFolder, matchingCategories,
} from "../model.js";

// The file system's model: folders as filters (the intersection of their
// path's categories), searching by path, and the split into what a
// folder's own folders show and what they don't.
describe("file system model", function () {
  let Animal, Cat, Dog, Photo, animals, cats, dogs, withDogs;
  let cat, dog, catAndDog, robin, car;

  beforeEach(function () {
    Animal = category("Animal");
    Cat = category("Cat");
    Dog = category("Dog");
    Photo = category("Photo");
    vault.categories = [Animal, Cat, Dog, Photo];
    withDogs = folder({ category: Dog, name: "With dogs" });
    cats = folder({ category: Cat }, withDogs);
    dogs = folder({ category: Dog });
    animals = folder({ category: Animal }, cats, dogs);
    vault.root = folder({ name: "All files" }, animals);
    const make = (slug, date, categories) => file({ slug, name: slug, date, categories, image: null, credit: null });
    cat = make("cat", "2001-01-01", [Animal, Cat, Photo]);
    dog = make("dog", "2003-01-01", [Animal, Dog]);
    catAndDog = make("cat-and-dog", "2002-01-01", [Animal, Cat, Dog]);
    robin = make("robin", "2000-01-01", [Animal]);
    car = make("car", "2004-01-01", []);
    vault.files = [cat, dog, catAndDog, robin, car];
  });

  it("a folder's path is its category and those above it - and shows what has them all", function () {
    assert.deepEqual(folderPath(withDogs).map((each) => each.name), ["Animal", "Cat", "Dog"]);
    assert.deepEqual(filesIn(folderPath(withDogs)), [catAndDog]);
    assert.deepEqual(filesIn(folderPath(vault.root)).length, 5, "the root: everything");
  });

  it("a path, in any order, is the folder with that path", function () {
    assert.equal(folderForPath([Dog, Animal, Cat]), withDogs);
    assert.equal(folderForPath([Animal]), animals);
    assert.equal(folderForPath([]), vault.root);
    assert.equal(folderForPath([Photo]), null, "no folder: a search");
  });

  it("split: what none of the folder's own folders shows, and what some does", function () {
    const { unsorted, sorted: sortedFiles } = splitBySubFolders(animals, folderPath(animals));
    assert.deepEqual(unsorted, [robin]);
    assert.deepEqual(sortedFiles, [cat, dog, catAndDog]);
  });

  it("given a category, an unsorted file is sorted - and taken away, unsorted again", function () {
    const Bird = category("Bird");
    addFolder(animals, Bird);
    addCategory(robin, Bird);
    assert.deepEqual(splitBySubFolders(animals, folderPath(animals)).unsorted, []);
    removeCategory(robin, Bird);
    assert.deepEqual(splitBySubFolders(animals, folderPath(animals)).unsorted, [robin]);
  });

  it("dropped on a folder, a file gets every category of its path", function () {
    fileInto(car, withDogs);
    assert.deepEqual(car.categoryIds, [Animal.id, Cat.id, Dog.id]);
    assert.ok(filesIn(folderPath(withDogs)).includes(car));
  });

  it("folders added and removed", function () {
    const added = addFolder(dogs, Photo);
    assert.equal(added.parent, dogs);
    assert.deepEqual(folderPath(added).map((each) => each.name), ["Animal", "Dog", "Photo"]);
    removeFolder(added);
    assert.deepEqual(dogs.children, []);
  });

  it("sorted by name, newest or oldest first", function () {
    assert.deepEqual(sorted(vault.files, "name").map((each) => each.id), ["car", "cat", "cat-and-dog", "dog", "robin"]);
    assert.deepEqual(sorted(vault.files, "newest").map((each) => each.id), ["car", "dog", "cat-and-dog", "cat", "robin"]);
    assert.deepEqual(sorted(vault.files, "oldest")[0], robin);
  });

  it("categories matched by what's typed - ignoring case - leaving out those given", function () {
    assert.deepEqual(matchingCategories("ca").map((each) => each.name), ["Cat"]);
    assert.deepEqual(matchingCategories("").length, 4);
    assert.deepEqual(matchingCategories("", [Animal, Cat]).map((each) => each.name), ["Dog", "Photo"]);
  });
});
