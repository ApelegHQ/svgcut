A utility library to convert SVG shapes to paths and reorder paths by proximity

For usage, see `test`.

## TODO

* Handle masks (now ignored)
* Handle viewboxes (now mostly ignored), including: nested `svg` elements, `symbol` and `viewBox` after certain transforms.
* Handle forward-referencing `use` `id`s
* Treat illegal paths non-fatally (as per § F.2 in SVG 1.1 and § 9.5.4 in SVG 2)
* Refactor code to allow using certain parts selectively
* Add more strategies for proximity
* Improve Node.js packing (add package.json and keep only `index.js` and `index.d.ts`)

