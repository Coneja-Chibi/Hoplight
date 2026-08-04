# Teaching fixtures

Three deliberately boring SillyTavern presets. They exist so a reader, or Kit, can see what each kind
of prompt block looks like without wading through a 300-block community preset.

All original neutral prose. Nothing here is derived from anyone else's preset.

| Fixture | Shows |
| --- | --- |
| `minimal.preset.json` | The smallest honest preset: a couple of system blocks, the engine's marker slots, chat history. The baseline everything else is compared against. |
| `tracker.preset.json` | A status readout assembled from variables: `setvar` writes, a `getvar` manifest, and where such a block sits in the order. |
| `utility.preset.json` | Output length, language and formatting dials, plus a toggle gate that enables or disables a block. |

Each renders clean through the real engine. That is checkable rather than asserted:

```
preset_verify engine=sillytavern preset=samples/sillytavern/fixtures/minimal.preset.json
```

A fixture that stops resolving is a broken fixture, so keep them clean.

## Why these three, and not more

They were chosen from a survey of 22 community presets, which found 24 distinct block categories.
Most of those categories are variations on the three ideas here: claim a slot, write state, read state
back. The survey's own finding was that in a variable-driven preset the majority of blocks emit
nothing at all - they write a named slot, and one assembler renders the result. A preset of that kind
is closer to a small program than to an ordered list of system messages, which is worth knowing before
reading one.
