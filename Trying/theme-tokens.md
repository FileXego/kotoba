# Theme tokens

> 状态：Trying 阶段统一主题契约。正式同步时 key 保持不变，展示名可以本地化。

## Theme keys

正式 key：

```text
light
dark
sumi
sakura
```

兼容别名只存在于 Trying：

```text
washi -> light
night -> dark
```

正式代码不要继续使用 `washi` 或 `night` 作为持久化 key。

## Token table

| key | display | bg | surface | text | muted | border | accent |
|---|---|---|---|---|---|---|---|
| light | Washi | `#fbf4e7` | `#fffdf8` | `#2f2922` | `#756956` | `#dfceb1` | `#b88435` |
| dark | Night | `#101112` | `#1e1f1f` | `#f1e5cf` | `#ab9e83` | `#3c3428` | `#b69a5f` |
| sumi | Sumi | `#0d1211` | `#161c1a` | `#eef2ea` | `#9aa9a2` | `#2e3a35` | `#b7c3bc` |
| sakura | Sakura | `#fbf1f2` | `#fffafb` | `#342b2f` | `#927883` | `#ead3d8` | `#b94f66` |

## Platform sync

Web:

- Use CSS variables.
- Persist `ThemeName = "light" | "dark" | "sumi" | "sakura"`.

iOS later:

- Copy token values into Swift enum or struct.
- Do not read Web TS directly.
- Cache last theme locally for offline display.

Android later:

- Copy token values into Kotlin theme model.
- Do not read Web TS directly.
- Cache last theme locally for offline display.

## Reduced-motion relation

Theme key does not imply animation.

Animation policy is separate:

```text
light/sakura: gold dust may be static
dark: warm star dust may breathe unless reduced motion
sumi: cool silver star dust may breathe unless reduced motion
```

## Sumi star-field contract

- Sumi uses deterministic pseudo-random star coordinates, not runtime random numbers.
- Dense clusters are allowed near the upper-left and upper-right areas.
- Sparse areas should keep darker ink-shadow fields so the scene does not become evenly bright.
- The `Dust effects` switch must disable both outer shell stars and in-phone stars.
- Formal production sync should keep the star-field CSS behind `VITE_MOBILE_EFFECTS_ENABLED` and `prefers-reduced-motion`.

## Sumi star field notes

The Trying prototype uses CSS-only, deterministic pseudo-random scatter:

- Dense clusters: several fixed `radial-gradient()` stars grouped around irregular coordinates.
- Sparse areas: isolated low-opacity points outside the clusters.
- Dark lanes: broad dark `radial-gradient(ellipse ...)` layers between clusters.
- Glow: a second pseudo-element adds quiet silver bloom behind the content.

No image file, canvas, runtime random generator, or dependency is used. `Dust effects`
must still cut off both the outer lab scene and the phone surface.
