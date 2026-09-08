import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const css = source.match(/<style id="builderFloatingBobPointsPanelCSS">([\s\S]*?)<\/style>/)?.[1] || "";
const script = source.match(/<script id="builderFloatingBobPointsPanelScript">([\s\S]*?)<\/script>/)?.[1] || "";

test("BOB artwork is a temporary nonblocking Builder presentation", () => {
  assert.match(css, /#thinkerBobWorkshop\{[\s\S]*position:fixed !important;[\s\S]*pointer-events:none !important;[\s\S]*opacity:0 !important/);
  assert.match(css, /builderBobFloatingVisible #thinkerBobWorkshop\{[\s\S]*opacity:1 !important/);
  assert.match(script, /entryVisibleUntil=Date\.now\(\)\+7000/);
  assert.match(script, /function studentIsReading\(\)\{\s*return false;\s*\}/);
  assert.doesNotMatch(script, /readToBobPracticeActive/);
  assert.match(script, /speechSynthesis\.speaking/);
  assert.match(script, /speechSynthesis\.pending/);
  assert.match(script, /speechSynthesis\.paused/);
});

test("right panel prioritizes the existing points board and coach controls", () => {
  assert.match(css, /#stemCoachHeader\{[\s\S]*display:none !important/);
  assert.match(css, /#readToBobStatsPanel\{[\s\S]*order:1 !important/);
  assert.match(css, /#stemCoachActionGroup\{[\s\S]*order:2 !important/);
  assert.match(css, /#stemCoachContent\{[\s\S]*order:3 !important/);
  assert.doesNotMatch(script, /cloneNode/);
});

test("retired oral-reading progress stays hidden without changing the right rail or touch targets", () => {
  assert.match(css, /#readToBobStatsHeader\{[\s\S]*font-size:10\.5px !important;[\s\S]*font-weight:950 !important/);
  assert.match(css, /#readToBobStatsReadings\{[\s\S]*font-size:10\.5px !important;[\s\S]*font-weight:950 !important/);
  assert.match(css, /\.readToBobStatsProgressCard strong\{[\s\S]*font-size:9\.5px !important;[\s\S]*font-weight:950 !important/);
  assert.match(css, /\.readToBobStatsProgressCard strong b\{[\s\S]*min-width:20px !important;[\s\S]*min-height:20px !important;[\s\S]*font-size:16px !important/);
  assert.match(css, /#readToBobStatsPanel\{[\s\S]*gap:2px 6px !important;[\s\S]*padding:4px 6px !important/);
  assert.match(css, /#stemCoachActionGroup\{[\s\S]*gap:4px !important;[\s\S]*margin:0 !important/);
  assert.match(css, /#readerHighlightBox\{[\s\S]*font-size:15\.5px !important;[\s\S]*line-height:1\.55 !important/);
  assert.match(source, /#builderBobRightPanel\{[\s\S]*width:var\(--builder-swap-right-width\) !important;[\s\S]*bottom:0 !important/);
  assert.match(source, /#builderBobRightPanel #stemCoachActionGroup button\{min-height:44px !important;\}/);
  assert.match(source, /#reopenLibraryFromCoach\{[\s\S]*min-height:48px !important/);
  assert.match(source, /#readToBobStatsPanel,[\s\S]*#readToBobPracticeButton\{[\s\S]*display:none !important/);
  assert.match(source, /#builderBobRightPanel #readToBobStatsPanel\[data-retired-student-oral-reading="true"\]\{\s*display:none !important/);
});

test("Open Library is the sole full-width reading action", () => {
  assert.equal((source.match(/id="reopenLibraryFromCoach"/g)||[]).length,1);
  assert.equal((source.match(/id="readToBobPracticeButton"/g)||[]).length,0);
  assert.match(source, /#stemCoachActionGroup\{[\s\S]*grid-template-columns:minmax\(0,1fr\) !important/);
  assert.match(source, /#reopenLibraryFromCoach\{[\s\S]*width:100% !important/);
});

test("right panel shows one full-height titled reading passage", () => {
  assert.match(css, /#rightHudColumn,[\s\S]*#builderBobRightPanel\{[\s\S]*top:var\(--builder-guided-edge\) !important/);
  assert.match(css, /#thinkerBobPanel > :not\(#readerHighlightBox\)\{[\s\S]*display:none !important/);
  assert.match(css, /#readerHighlightBox\{[\s\S]*flex:1 1 auto !important;[\s\S]*max-height:none !important;[\s\S]*overflow-y:auto !important/);
  assert.match(css, /#readerHighlightBox::before\{[\s\S]*attr\(data-passage-title\)[\s\S]*font:900 14px/);
  assert.match(source, /activeReaderPassage\.dataset\.passageTitle = info\.title/);
});

test("structured passage retains headings and authoritative vocabulary actions", () => {
  assert.match(source, /function renderStructuredToolReader\(info, toolId\)/);
  assert.doesNotMatch(source, /class="readerLessonSection readerLessonTitle"/);
  assert.match(source, /wordIndex \+= countPreparedWords\(window\.currentBuilderBobPlayfulIntro \|\| ""\)[\s\S]*wordIndex \+= countPreparedWords\(info\.title\)/);
  assert.match(source, /const vocabularyButtons = makeVocabButtons\(toolId,info\.vocabulary\)/);
  assert.match(source, /renderStructuredToolReader\(info,toolId\)/);
  assert.match(source, /class="readerLessonSection readerVocabularySection"/);
  assert.match(css, /#readerHighlightBox h3,[\s\S]*#readerHighlightBox h4\{[\s\S]*color:#ffd766 !important;[\s\S]*font-weight:900 !important/);
  assert.match(css, /\.readerVocabularyButtons \.vocabButton\{[\s\S]*min-height:44px !important/);
  assert.match(script, /activeShowToolInfo=window\.showToolInfo/);
  assert.match(script, /activeShowToolInfo\.apply\(this,arguments\)[\s\S]*renderStructuredToolReader\(info,toolId\)/);
  assert.match(script, /structuredReaderFinalOwner/);
});

test("BOB owns passage guidance, vocabulary handoff, and selected-word feedback", () => {
  assert.match(css, /#builderFloatingBobMessage\{[\s\S]*position:absolute[\s\S]*aria-live|#builderFloatingBobMessage\{/);
  assert.doesNotMatch(css, /CLICK A WORD TO READ FROM THERE/);
  assert.match(script, /lessonReadingPending && lessonSpeechWasActive && !speechActive/);
  assert.match(script, /movePassageToVocabulary\(\)/);
  assert.match(script, /vocabulary\.offsetTop-passage\.offsetTop/);
  assert.match(script, /Click a vocabulary word for more ideas\./);
  assert.match(script, /selectedVocabularyWord=String\(word/);
  assert.match(script, /Vocabulary: <strong>"\+selectedVocabularyWord/);
  assert.match(script, /vocabularySpeechLeadTimer=window\.setTimeout[\s\S]*},500\)/);
  assert.match(script, /floatingMessage\.setAttribute\("aria-live","polite"\)/);
  assert.match(script, /Click a word to read from there\./);
  assert.match(source, /var itemOpeners = \{[\s\S]*"volcano":"This topic is erupting with ideas[\s\S]*"dna":"DNA stands for Definitely Neat Answers[\s\S]*"golgi body":"Special delivery!/);
  assert.match(source, /var playfulOpener = itemOpeners\[openerKey\] \|\| fallbackOpeners\[fallbackIndex\]/);
  assert.match(source, /playfulIntro \+ " " \+ buildThinkerBobSpeech\(info\)/);
  assert.match(source, /window\.currentBuilderBobPlayfulOpener = playfulOpener/);
  assert.match(source, /builderBobPlayfulExpression/);
  assert.match(source, /attentionGetters = \[[\s\S]*Breaking STEM news![\s\S]*Idea Galaxy[\s\S]*THINKamigBOB studio/);
  assert.match(source, /attentionUtterance=expressiveUtterance\(attentionGetter,1\.18/);
  assert.match(source, /playfulUtterance = expressiveUtterance\(playfulOpener,1\.10/);
  assert.match(source, /lessonContinuation:true,wordOffset:playfulIntro\.split/);
  assert.match(source, /builderBobLessonTransition/);
  assert.match(script, /builderBobExpressiveMessage/);
  assert.match(css, /@keyframes builderBobPlayfulReaction/);
  assert.match(css, /builderBobPlayfulReaction \.88s ease-in-out 2/);
  assert.match(source, /ChromeOS can clip the beginning[\s\S]*audioPrimer=expressiveUtterance\("Ready",1,1\)[\s\S]*audioPrimer\.volume=0\.01/);
  assert.match(source, /audioPrimer\.onend=function\(\)[\s\S]*speechSynthesis\.speak\(attentionUtterance\)[\s\S]*},120/);
  assert.match(css, /prefers-reduced-motion:reduce[\s\S]*builderBobPlayfulExpression[\s\S]*animation:none/);
  assert.match(css, /data-message-state="welcome"[\s\S]*#8ff6ff/);
  assert.match(css, /data-message-state="reading"[\s\S]*#78edff/);
  assert.match(css, /data-message-state="vocabulary"[\s\S]*#ffe16a/);
  assert.match(css, /data-message-state="attention"[\s\S]*#ff9fdf/);
  assert.match(css, /data-message-state="joke"[\s\S]*#b8ff65/);
  assert.match(css, /#builderBobFunSpeechBubble\{[\s\S]*border-radius:22px[\s\S]*pointer-events:none/);
  assert.match(css, /#builderBobFunSpeechBubble::after/);
  assert.match(css, /builderBobFunBubbleVisible #builderBobFunSpeechBubble/);
  assert.match(script, /funSpeechBubble\.dataset\.stage=state/);
  assert.match(script, /funSpeechBubble\.setAttribute\("aria-live","polite"\)/);
});

test("highlighted yellow heading words switch to dark readable text", () => {
  assert.match(css, /#readerHighlightBox h3 \.readWord\.currentReadWord,[\s\S]*#readerHighlightBox h4 \.readWord\.currentReadWord\{[\s\S]*color:#10202b !important;[\s\S]*text-shadow:none !important/);
});

test("existing Save and Open controls move above Return to Missions", () => {
  assert.match(script, /projectActions\.appendChild\(save\)/);
  assert.match(script, /projectActions\.appendChild\(open\)/);
  assert.match(script, /mission\.insertBefore\(projectActions,returnButton\)/);
  assert.match(css, /#builderProjectActionsLeft\{[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /#builderRightToolsPanel #builderProjectActionsLeft #builderSaveButton,[\s\S]*#builderOpenButton\{[\s\S]*display:flex !important/);
  assert.doesNotMatch(script, /addEventListener\(["'](?:click|keydown|wheel|pointerdown)/);
});
