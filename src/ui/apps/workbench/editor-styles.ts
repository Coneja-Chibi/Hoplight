/**
 * Merged Editor CSS modules (chrome/fields/bento/playbill/quiz/composites).
 */
import chrome from "./Editor.module.css";
import fields from "./Editor.fields.module.css";
import portrait from "./Editor.portrait.module.css";
import bento from "./Editor.bento.module.css";
import playbill from "./Editor.playbill.module.css";
import quiz from "./Editor.quiz.module.css";
import composites from "./Editor.composites.module.css";

const styles: Record<string, string> = {
  ...chrome,
  ...fields,
  ...portrait,
  ...bento,
  ...playbill,
  ...quiz,
  ...composites,
};

export default styles;
