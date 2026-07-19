/**
 * Media bridges: hub pack/named <-> host wire. One file per host shape.
 * CCv3 full media inverse lives in ../assets.ts (mergeMediaIntoCcv3Assets).
 *
 * Deliberately no marinara bridge: Marinara Engine's card wire is a CCv3 card and its
 * CharacterExtensions carry no expressions bag (verified against the engine source); emotion
 * packs ride the ccv3-emotion bridge like any CCv3 card, and the engine's runtime
 * spriteExpressions map is chat state, not card data.
 */
export {
  type Ccv3AssetRow,
  type EmotionWireType,
  packFromCcv3Assets,
  mergePackIntoCcv3Assets,
  bodyEmotionsFromPack,
} from "./ccv3-emotion";

export {
  namedFromRisuAdditional,
  risuAdditionalFromNamed,
  namedFromRisuOriginal,
  originalWithNamed,
} from "./risu-named";

export {
  packFromLumiExpressions,
  lumiExpressionsFromPack,
  packsFromLumiGroups,
  lumiGroupsFromPacks,
  packFromLumiOriginal,
  groupsFromLumiOriginal,
  originalWithLumiPack,
} from "./lumi-expressions";

export {
  packFromChubExpressions,
  chubExpressionsFromPack,
  packFromChubOriginal,
  originalWithChubPack,
} from "./chub-expressions";
