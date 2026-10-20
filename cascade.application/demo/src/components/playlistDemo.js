import { Component, callback, observable, deeplyObservable } from "@liquefy/cascade.component";
import { div, span, text, input, button as htmlButton } from "@liquefy/cascade.dom";
import { icon, themeColor } from "@liquefy/cascade.ui";

/**
 * The playlist demo - the Showcase page's "Just change your objects": a
 * model of plain objects (`playlist`), shown as what it is - an object, its
 * values editable - and a small player app built on it, side by side. Lines
 * of code under the model change it when clicked, the very code shown run
 * as it stands; and the model is on `window`, for the browser's console.
 *
 * Nothing in the app is told what depends on what: each of its components
 * reads what it shows, and is rebuilt when - and only when - that changes.
 * To make that visible, each of them outlines itself in yellow as it
 * rebuilds, and a counter says how many of them did (see watched()) - a
 * song liked rebuilds its row and the liked badge, never the total time.
 */

// The model: plain objects, made observable.
export const playlist = deeplyObservable({
  nowPlaying: null,
  songs: [
    { title: "Signals at Dusk", seconds: 214, liked: true },
    { title: "One Pass", seconds: 187, liked: false },
    { title: "Proxies in Bloom", seconds: 242, liked: false },
    { title: "Sub-frame Serenade", seconds: 198, liked: true },
  ],
});

// In the browser's console, too: `playlist.songs[0].title = "Hello"` - and
// observable(), for what's added to it: a new object is made observable
// by whoever makes it (see the push line in CodeLines).
if (typeof(window) !== "undefined") Object.assign(window, { playlist, observable });

// What the lines of code under the model put there, in turn.
const newTitles = ["Hello, World", "Ode to Proxies", "Temporal Tango", "No Virtual DOM"];
const newSongs = [
  { title: "Keyed and Kept", seconds: 205 },
  { title: "Render Context Blues", seconds: 231 },
  { title: "Pattern Matched", seconds: 176 },
  { title: "Fine-grained", seconds: 219 },
];

// A song's key, in the lists showing it - the song itself is a plain
// object, with nothing but its own values in it.
const songKeys = new WeakMap();
let lastSongKey = 0;
function keyOf(song) {
  if (!songKeys.has(song)) songKeys.set(song, "song" + (++lastSongKey));
  return songKeys.get(song);
}

const minutes = (seconds) => Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");

/**
 * Rebuilds, counted and shown. A watched component (see watched()) reports
 * every build; once the page has settled, each one is a rebuild: its
 * element is outlined for a moment, and `rebuilds` - what the counter
 * shows - says how many of the watched components there are rebuilt, at
 * the last change. Done once the builds of a change are over (a timer):
 * nothing observable is written while anything builds.
 */
export const rebuilds = deeplyObservable({ count: null, total: 0 });
const tally = { live: new Set(), rebuilt: new Set(), armed: false, arming: false, publishing: false };

function noteBuild(component) {
  if (!tally.armed) {
    // The first builds - the page coming up - aren't rebuilds.
    if (!tally.arming) {
      tally.arming = true;
      setTimeout(() => { tally.armed = true; }, 600);
    }
    return;
  }
  tally.rebuilt.add(component);
  if (tally.publishing) return;
  tally.publishing = true;
  setTimeout(() => {
    tally.publishing = false;
    for (const each of tally.rebuilt) flash(each);
    rebuilds.count = tally.rebuilt.size;
    rebuilds.total = tally.live.size;
    tally.rebuilt.clear();
  });
}

// A yellow outline, fading - on the element a component built.
function flash(component) {
  const built = component.currentBuild;
  const node = built && built.unobservable && built.unobservable.node;
  if (!node || !node.isConnected || typeof(node.animate) !== "function") return;
  node.animate(
    [
      { outline: "2px solid rgba(255, 196, 0, 1)", outlineOffset: "-2px", backgroundColor: "rgba(255, 214, 10, 0.25)" },
      { outline: "2px solid rgba(255, 196, 0, 0)", outlineOffset: "-2px", backgroundColor: "rgba(255, 214, 10, 0)" },
    ],
    { duration: 1100, easing: "ease-out" },
  );
}

// A component class whose rebuilds are counted and shown - the class
// itself as it would be anyway: a plain Component, with a plain build().
function watched(Base) {
  const name = Base.name;
  return {
    [name]: class extends Base {
      onEstablish() {
        super.onEstablish();
        tally.live.add(this);
      }

      onDispose() {
        tally.live.delete(this);
        super.onDispose();
      }

      build() {
        const built = super.build();
        noteBuild(this);
        return built;
      }
    },
  }[name];
}

/**
 * The demo: the model and its lines of code on the left, the player on
 * the right - one under the other, when `narrow`.
 */
export class PlaylistDemo extends Component {
  setProperties({ narrow }) {
    this.narrow = !!narrow;
  }

  build() {
    return div(
      { style: { display: "grid", gridTemplateColumns: this.narrow ? "1fr" : "1.25fr 1fr", gap: "24px", alignItems: "start" } },
      div(
        { key: "model", style: { display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 } },
        new ModelView({ playlist }),
        new CodeLines({ playlist }),
      ),
      div(
        { key: "app", style: { display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 } },
        new Player({ playlist }),
        new RebuildCounter(),
      ),
    );
  }
}

// --- The model, as an object ---------------------------------------------

const code = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: "13px", lineHeight: 1.75,
};
const codeColors = { keyword: "#d73a49", name: "#6f42c1", string: "#032f62", value: "#005cc5", plain: "#24292e", quiet: "#6a737d" };
const token = (color, words) => span({ style: { color } }, text(words));

// What a value is edited with, in the object: as wide as what's in it.
const valueInput = (properties) => input({
  ...properties,
  style: {
    ...code, color: properties.type === "number" ? codeColors.value : codeColors.string, background: "rgba(3, 47, 98, 0.06)",
    border: "1px dashed rgba(3, 47, 98, 0.3)", borderRadius: "4px", padding: "0 2px", margin: 0, boxSizing: "content-box",
    width: properties.width, minWidth: "2ch",
  },
});

// The model as the object it is - `const playlist = deeplyObservable({...})`
// - its values editable where they are.
class ModelView extends Component {
  setProperties({ playlist }) {
    this.playlist = playlist;
  }

  build() {
    const { playlist } = this;
    const playing = playlist.songs.indexOf(playlist.nowPlaying);
    return div(
      { style: { ...code, color: codeColors.plain, padding: "16px 20px", borderRadius: "16px", background: themeColor.surface, border: "1px solid " + themeColor.border, boxShadow: "0 24px 48px -28px rgba(0, 0, 0, 0.35)", overflowX: "auto", whiteSpace: "nowrap" } },
      div(token(codeColors.keyword, "const "), token(codeColors.plain, "playlist = "), token(codeColors.name, "deeplyObservable"), token(codeColors.plain, "({")),
      div(
        { style: { paddingLeft: "2ch" } },
        token(codeColors.plain, "nowPlaying: "),
        playing >= 0 ? token(codeColors.plain, "songs[" + playing + "]") : token(codeColors.value, "null"),
        token(codeColors.plain, ","),
      ),
      div({ style: { paddingLeft: "2ch" } }, token(codeColors.plain, "songs: [")),
      playlist.songs.map((song) => new ModelSong({ key: keyOf(song), song })),
      div({ style: { paddingLeft: "2ch" } }, token(codeColors.plain, "],")),
      div(token(codeColors.plain, "});")),
    );
  }
}

// A song in the model: `{ title: "...", seconds: 214, liked: true },`.
class ModelSong extends Component {
  setProperties({ song }) {
    this.song = song;
  }

  build() {
    const { song } = this;
    return div(
      { style: { paddingLeft: "4ch" } },
      token(codeColors.plain, "{ title: "),
      valueInput({
        type: "text", value: song.title, width: Math.max(2, song.title.length) + "ch", "aria-label": "Title",
        oninput: callback("title", (event) => { song.title = event.target.value; }),
      }),
      token(codeColors.plain, ", seconds: "),
      valueInput({
        type: "number", min: 1, max: 999, value: song.seconds, width: String(song.seconds).length + 2 + "ch", "aria-label": "Seconds",
        oninput: callback("seconds", (event) => { const seconds = Math.round(Number(event.target.value)); if (seconds > 0) song.seconds = seconds; }),
      }),
      token(codeColors.plain, ", liked: "),
      htmlButton(
        {
          title: "Click to change",
          onclick: callback("liked", () => { song.liked = !song.liked; }),
          style: { ...code, color: codeColors.value, background: "rgba(0, 92, 197, 0.07)", border: "1px dashed rgba(0, 92, 197, 0.35)", borderRadius: "4px", padding: "0 4px", cursor: "pointer" },
        },
        text(String(song.liked)),
      ),
      token(codeColors.plain, " },"),
    );
  }
}

// Lines of code that change the model, each run as it's shown when
// clicked - what they say changes as the model does.
class CodeLines extends Component {
  setProperties({ playlist }) {
    this.playlist = playlist;
  }

  initialState() {
    return { renamed: 0, added: 0, played: 0 };
  }

  build() {
    const { playlist } = this;
    const songs = playlist.songs;
    const liked = songs.length > 1 ? 1 : 0;
    const title = newTitles[this.renamed % newTitles.length];
    const added = newSongs[this.added % newSongs.length];
    const played = songs.length > 0 ? this.played % songs.length : 0;
    const lines = [
      { key: "like", source: `playlist.songs[${liked}].liked = ${songs.length > 0 ? !songs[liked].liked : true}`, enabled: songs.length > 0 },
      { key: "rename", source: `playlist.songs[0].title = "${title}"`, enabled: songs.length > 0, then: () => { this.renamed++; } },
      // A new song made observable, as the ones it starts with are - or
      // changing it later would go unseen.
      { key: "push", source: `playlist.songs.push(observable({ title: "${added.title}", seconds: ${added.seconds}, liked: false }))`, enabled: songs.length < 8, then: () => { this.added++; } },
      { key: "reverse", source: "playlist.songs.reverse()", enabled: songs.length > 1 },
      { key: "pop", source: "playlist.songs.pop()", enabled: songs.length > 1 },
      { key: "play", source: `playlist.nowPlaying = playlist.songs[${played}]`, enabled: songs.length > 0, then: () => { this.played++; } },
    ];
    return div(
      { style: { display: "flex", flexDirection: "column", gap: "8px" } },
      div({ style: { fontSize: "14px", fontWeight: 600, filter: "opacity(0.8)" } }, text("Click a line to run it:")),
      lines.map(({ key, source, enabled, then }) => htmlButton(
        {
          key,
          disabled: !enabled,
          title: "Run this line",
          onclick: callback(key, () => {
            // The very code shown - nothing else.
            new Function("playlist", "observable", source)(playlist, observable);
            if (then) then();
          }),
          style: {
            ...code, display: "flex", alignItems: "center", gap: "10px", textAlign: "left", padding: "8px 14px", borderRadius: "10px",
            color: codeColors.plain, background: themeColor.surface, border: "1px solid " + themeColor.border,
            cursor: enabled ? "pointer" : "default", opacity: enabled ? 1 : 0.45,
          },
        },
        span({ class: "material-symbols-outlined", style: { fontSize: "18px", color: themeColor.accent, flex: "none" } }, text("play_arrow")),
        span({ style: { minWidth: 0, overflowWrap: "anywhere" } }, text(source)),
      )),
    );
  }
}

// --- The app built on it -------------------------------------------------

// The player: a header with the liked badge and the total time, the songs,
// and what's playing.
class Player extends Component {
  setProperties({ playlist }) {
    this.playlist = playlist;
  }

  build() {
    const { playlist } = this;
    return div(
      { style: { borderRadius: "16px", overflow: "hidden", background: themeColor.surface, border: "1px solid " + themeColor.border, boxShadow: "0 24px 48px -28px rgba(0, 0, 0, 0.35)" } },
      div(
        { style: { display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px", color: "white", background: `linear-gradient(135deg, ${themeColor.accent}, ${themeColor.accentDark})` } },
        icon({ name: "queue_music", style: { fontSize: "26px" } }),
        div({ style: { fontWeight: 700, fontSize: "17px", flex: "1 1 auto" } }, text("Weekend mix")),
        new LikedBadge({ playlist }),
        new TotalTime({ playlist }),
      ),
      new SongList({ playlist }),
      new NowPlaying({ playlist }),
    );
  }
}

const badgeStyle = { display: "flex", alignItems: "center", gap: "4px", padding: "3px 10px", borderRadius: "999px", fontSize: "14px", fontWeight: 600, background: "rgba(255, 255, 255, 0.18)" };

// The liked badge: what it reads, it depends on - nothing to declare.
const LikedBadge = watched(class LikedBadge extends Component {
  setProperties({ playlist }) {
    this.playlist = playlist;
  }

  build() {
    const liked = this.playlist.songs.filter((song) => song.liked).length;
    return div(
      { style: badgeStyle },
      icon({ name: "favorite", style: { fontSize: "16px" } }),
      text(liked + " liked"),
    );
  }
});

const TotalTime = watched(class TotalTime extends Component {
  setProperties({ playlist }) {
    this.playlist = playlist;
  }

  build() {
    const seconds = this.playlist.songs.reduce((sum, song) => sum + song.seconds, 0);
    return div({ style: { fontSize: "14px", fontVariantNumeric: "tabular-nums", filter: "opacity(0.9)" } }, text(minutes(seconds)));
  }
});

// The songs: which there are, in order - not what's in them (see
// SongRow), so a title changed doesn't rebuild the list.
const SongList = watched(class SongList extends Component {
  setProperties({ playlist }) {
    this.playlist = playlist;
  }

  build() {
    const { playlist } = this;
    return div(
      { style: { display: "flex", flexDirection: "column", padding: "6px" } },
      playlist.songs.length === 0
        ? div({ style: { padding: "16px", textAlign: "center", opacity: 0.6 } }, text("No songs - push one."))
        : playlist.songs.map((song) => new SongRow({ key: keyOf(song), song, playlist })),
    );
  }
});

const SongRow = watched(class SongRow extends Component {
  setProperties({ song, playlist }) {
    this.song = song;
    this.playlist = playlist;
  }

  build() {
    const { song, playlist } = this;
    return div(
      {
        title: "Play",
        onclick: callback("play", () => { playlist.nowPlaying = song; }),
        style: { display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "10px", cursor: "pointer", color: themeColor.text },
      },
      icon({ name: "music_note", style: { fontSize: "20px", color: themeColor.textSoft } }),
      div({ style: { flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 } }, text(song.title)),
      div({ style: { fontSize: "14px", fontVariantNumeric: "tabular-nums", color: themeColor.textSoft } }, text(minutes(song.seconds))),
      htmlButton(
        {
          title: song.liked ? "Unlike" : "Like",
          onclick: callback("like", (event) => {
            event.stopPropagation();
            song.liked = !song.liked;
          }),
          style: { display: "flex", padding: "4px", border: "none", borderRadius: "50%", background: "transparent", cursor: "pointer", color: song.liked ? "#e0245e" : themeColor.textSoft },
        },
        span({ class: "material-symbols-outlined", style: { fontSize: "20px", fontVariationSettings: song.liked ? "'FILL' 1" : "'FILL' 0" } }, text("favorite")),
      ),
    );
  }
});

const NowPlaying = watched(class NowPlaying extends Component {
  setProperties({ playlist }) {
    this.playlist = playlist;
  }

  build() {
    const song = this.playlist.nowPlaying;
    return div(
      { style: { display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", borderTop: "1px solid " + themeColor.border, color: themeColor.text, fontSize: "15px" } },
      icon({ name: song ? "graphic_eq" : "pause_circle", style: { fontSize: "22px", color: themeColor.accent } }),
      song
        ? div({ style: { flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, text("Now playing: "), span({ style: { fontWeight: 600 } }, text(song.title)))
        : div({ style: { flex: "1 1 auto", opacity: 0.6 } }, text("Nothing playing - click a song.")),
    );
  }
});

// How many of the app's components the last change rebuilt.
class RebuildCounter extends Component {
  build() {
    const { count, total } = rebuilds;
    return div(
      { style: { display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderRadius: "12px", fontSize: "15px", background: "rgba(255, 214, 10, 0.16)", border: "1px solid rgba(255, 196, 0, 0.45)" } },
      span({ class: "material-symbols-outlined", style: { fontSize: "20px", color: "#c99700" } }, text("bolt")),
      count === null
        ? text("Change something - each component outlines itself in yellow as it rebuilds.")
        : span(text("Last change: "), span({ style: { fontWeight: 700 } }, text(count + " of " + total)), text(" components rebuilt.")),
    );
  }
}
