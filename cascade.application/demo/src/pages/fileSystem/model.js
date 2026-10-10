import { observable } from "@liquefy/cascade.component";

/**
 * The file system's model - ported from erobwen/filesystem's
 * application/model, without what that proof of concept only experimented
 * with (folder groups, union folders, rules, quick access).
 *
 * A hybrid of tags and folders:
 *
 *  - A category is a tag: Cat, Photo, Favorite, ...
 *  - A file has any number of categories.
 *  - A folder is a filter: it has a category, and shows every file that has
 *    its category and those of all folders above it - the intersection.
 *    So a file shows in every folder whose path its categories cover: a
 *    photo of a cat and a dog is in Animals › Cats, in Animals › Dogs, and
 *    in Photos.
 *  - A path - what the path bar shows - is just such an intersection of
 *    categories, folder or not: searching is adding categories to it.
 *
 * Everything here is observable, and changed only by the user (through the
 * page's event handlers): arrays and the like are replaced, never changed
 * in place, so whoever read them follows.
 */

let nextId = 1;

export function category(name, icon = null) {
  return observable({ id: "c" + nextId++, name, icon });
}

export function file({ slug, name, date, categories, image, credit }) {
  return observable({
    id: slug, name, date, image, credit,
    categoryIds: categories.map((each) => each.id),
  });
}

// A folder for `category` (none: the root, showing every file), named after
// it unless given a name, with folders under it.
export function folder({ category = null, name, icon = null, open = false }, ...children) {
  const result = observable({
    id: "f" + nextId++,
    category,
    name: name || (category ? category.name : ""),
    icon,
    open,
    parent: null,
    children,
  });
  for (const child of children) child.parent = result;
  return result;
}

// Everything there is: what the demo starts with (see demoData.js).
export const vault = observable({ categories: [], files: [], root: null });

export function categoryById(id) {
  return vault.categories.find((each) => each.id === id) || null;
}

// A new category - picked from what the user typed, where none matched.
export function createCategory(name) {
  const created = category(name.trim().replace(/^./, (first) => first.toUpperCase()));
  vault.categories = [...vault.categories, created];
  return created;
}

// The categories of a folder's path: its own, and those of all folders
// above it.
export function folderPath(of) {
  const path = [];
  for (let each = of; each; each = each.parent) {
    if (each.category) path.unshift(each.category);
  }
  return path;
}

// The folder whose path is exactly these categories - in any order - if
// there is one. The one given first, if it qualifies.
export function folderForPath(path, preferred = null) {
  const ids = path.map((each) => each.id).sort().join("|");
  const same = (candidate) => folderPath(candidate).map((each) => each.id).sort().join("|") === ids;
  if (preferred && same(preferred)) return preferred;
  const search = (candidate) => {
    if (same(candidate)) return candidate;
    for (const child of candidate.children) {
      const found = search(child);
      if (found) return found;
    }
    return null;
  };
  return vault.root ? search(vault.root) : null;
}

export function hasCategory(item, category) {
  return item.categoryIds.includes(category.id);
}

// Whether a file has every category of a path.
export function inPath(item, path) {
  return path.every((each) => hasCategory(item, each));
}

export function filesIn(path) {
  return vault.files.filter((each) => inPath(each, path));
}

// The files of a folder that none of its sub-folders shows - those that
// need sorting further - and those that some sub-folder does.
export function splitBySubFolders(within, path) {
  const childPaths = within.children.filter((child) => child.category).map((child) => [...path, child.category]);
  const unsorted = [];
  const sorted = [];
  for (const each of filesIn(path)) {
    (childPaths.some((childPath) => inPath(each, childPath)) ? sorted : unsorted).push(each);
  }
  return { unsorted, sorted };
}

export const sortOrders = {
  name: { label: "Name", compare: (a, b) => a.name.localeCompare(b.name) },
  newest: { label: "Newest first", compare: (a, b) => b.date.localeCompare(a.date) },
  oldest: { label: "Oldest first", compare: (a, b) => a.date.localeCompare(b.date) },
};

export function sorted(files, order) {
  return [...files].sort(sortOrders[order].compare);
}

// Tagging - every change replaces the file's categories.

export function addCategory(item, category) {
  if (!hasCategory(item, category)) item.categoryIds = [...item.categoryIds, category.id];
}

export function removeCategory(item, category) {
  if (hasCategory(item, category)) item.categoryIds = item.categoryIds.filter((id) => id !== category.id);
}

// Dropped on a folder: the file gets every category it needs to show there.
export function fileInto(item, target) {
  for (const each of folderPath(target)) addCategory(item, each);
}

// Folders - every change replaces the parent's children.

export function addFolder(parent, category) {
  const added = folder({ category });
  added.parent = parent;
  parent.children = [...parent.children, added];
  parent.open = true;
  return added;
}

export function removeFolder(removed) {
  const parent = removed.parent;
  if (!parent) return;
  parent.children = parent.children.filter((each) => each !== removed);
}

// Categories whose names start with what was typed (ignoring case and
// spaces), leaving out those given.
export function matchingCategories(query, leaveOut = []) {
  const normalize = (value) => value.toLowerCase().replace(/\s/g, "");
  const typed = normalize(query);
  const excluded = new Set(leaveOut.map((each) => each.id));
  return vault.categories.filter((each) => !excluded.has(each.id) && normalize(each.name).startsWith(typed));
}

export function exactCategory(query) {
  const normalize = (value) => value.toLowerCase().replace(/\s/g, "");
  return vault.categories.find((each) => normalize(each.name) === normalize(query)) || null;
}
