# Story

The game is played as a story in eight chapters. Every session that touches chapters, levels or dialogue should follow this outline.

## Setting

Port Murmur, a lively harbor city. Mayor Prudence Quill passes the Silence Act, officially after noise complaints from the Velvet Heights district. A new Quiet Squad enforces it with decibel meters.

Behind the law is Drone and Partners, a corporation owned by the mayor's brother-in-law, Victor Drone. It runs huge offices of dull, repetitive desk work under the slogan "Focus pays." Drone wants the city silent because music makes people happy and distracted, and a joyless workforce earns him money. He funded Quill's campaign, and his company fabricated the Velvet Heights complaints. The Silence Act stays a city law; Quill uses her power to enforce it on Drone's behalf. The Quiet Squad, the raids and the roadblocks are the mayor serving Drone.

Velvet Heights is Drone's office district: gray towers, silent commuters in gray suits, nobody humming in the lifts.

## Theme

How corporate money and political power become entangled. Every act of enforcement in the story traces back to Drone's interests. The story never says this outright early on; it shows up in small hints (a billboard, an officer who is unsure who gives the orders) and is proven in chapter 7.

## Hero

Pip, a shy street trumpeter who just wants to keep playing. Over the story Pip slowly grows into a leader.

## Tone

Mostly light and satirical, with a few serious moments. Drone and Partners is the exception; see "Drone and Partners" in the style guide below.

## Chapters

1. Last Song. Pip busks on a corner when the Quiet Squad arrives and must slip away through the crowd. This is the current level 1. It teaches cones, crowds and coins.
2. Strike Up. Pip meets Ma Ruby, owner of the Brass Cellar venue. New mechanic: playing the trumpet draws nearby people into a crowd around Pip, but raises a noise meter that pulls police toward Pip. Built as level 2, "Harbor Quay": a quiet quay to try the trumpet, a stretch of fish stalls, then a guarded square in front of the old fish auction with no marching crowds. Locals gather while Pip plays, stay with him a few seconds after he stops, then drift home; a full noise meter sends nearby officers to look where Pip was. Intro on the foggy harbor with Gus (who explains it in fishmonger terms) and Officer Mute; outro in the Brass Cellar, where Ruby introduces herself and asks Pip to put up posters for a secret concert, setting up chapter 3.
3. Night Posters. New element: darkness and street lighting. Built as level 3, "Night Street". Officers carry flashlights; in the dark they only spot Pip at about half their range, under a street lamp at full range. Pip must put up at least four of six posters for Ruby's secret concert (standing still at a wall for a few seconds each). The spots are the old torn show bills still on the walls, where the street remembers the music; in the game each is a pale paper outline that glows through the dark, and icons at the screen edge point to the ones off-screen. The first is a few steps from the start in a dark corner, to learn on; the finish, the night tram, stays closed until four are up, the fifth and sixth pay bonus coins, and every poster colors the wall around it. Sound carries further at night, so the trumpet is heard, and noticed, from further away. First in-level choice: tagging the Quiet Squad van parked under the brightest lamp pays 50 coins and sets the flag van_tagged when the chapter is finished (true if tagged, false if not). Intro in the Brass Cellar, where Ruby hands over the posters and mentions the van; outro at the tram stop, where the Squad's radio reacts to the van either way and Sergeant Hush orders the printer and the venue found, setting up chapter 4.
4. The Raid. Police storm the Brass Cellar. New mechanic: police chase and search the last seen spot (built and tried on a development practice level; the chapter's level turns it on with `"chaseMode": true` in its data). Serious beat. Choice: help Ruby carry her instruments out (slower, riskier) or run. If Pip runs, Ruby does not appear later. Note for building chapter 4: its level must read van_tagged through the existing modifiers, for example `"modifiers": [{ "if": { "van_tagged": true }, "visionRangeFactor": 1.15, "officerSpeedFactor": 1.1, "catchTimeFactor": 0.8 }]`, so the police start more alert when the van was tagged.
5. Drummer Boy. Escort Teun, a loud drummer who hides poorly, to a secret rehearsal space. New mechanic: an ally who follows the player and needs cover. Teun is arrested at the end.
6. Roadblocks. Barricades that move during the level. Before the level, the mayor's aide offers to release Teun in exchange for the organizers' names. Accepting brings Teun back but shrinks crowds in chapters 7 and 8. Refusing keeps Teun locked up until the finale.
7. Velvet Heights. Drone's office district: gray towers, near-empty plazas and silent commuters, pure stealth. Pip finds proof of three things: the noise complaints were fabricated by Drone and Partners, Victor Drone funded the mayor's campaign, and internal company reports celebrate the Silence Act's effect on productivity.
8. The Big Noise. A march to city hall for a giant street concert, using every mechanic. Earlier choices set crowd size, whether Ruby and Teun join, and police alertness. Three ending scenes depend on those choices.

## Design rules

- Each chapter adds exactly one new element.
- There is one fixed sequence of chapters. Choices only change values inside chapters, never which chapter comes next.

## Characters so far

- Pip: the player. Shy and hesitant out loud, dry and funny inside. Plays Grandad's old trumpet.
- Sergeant Hush: leads the Quiet Squad. Quotes the Silence Act by section and subsection.
- Officer Mute: Hush's partner. Reads the decibel meter aloud with great ceremony.
- Gus: fishmonger on Main Street, Pip's most loyal listener. His haddock love the sad song. Fined forty coins after chapter 1 and took it cheerfully.
- Ma Ruby: owner of the Brass Cellar, a hidden venue under the old fish auction (door with no handle; knock twice, hum a B-flat), open thirty years. Long red coat, rings shaped like brass horns. Appears as "Stranger" at the end of chapter 1 and introduces herself in chapter 2. Warm and blunt: "Down here, loud is polite." Planning a secret concert.
- Old Jonas: an accordion player who sold his accordion because of the fines (mentioned by Ruby in chapter 2).
- Mayor Prudence Quill: heard over loudspeakers so far. Announces the joys of silence at full volume.
- Victor Drone: owner of Drone and Partners and Mayor Quill's brother-in-law. Funded her campaign. Not seen yet; when he appears he is calm, polite and precise, and speaks about people as output.
- Drone and Partners: the corporation. Huge offices of repetitive desk work, slogan "Focus pays." Its name already shows on billboards in chapter 1 and in Officer Mute's nervous remark in chapter 2.
- Commuters: Drone's office workers in gray suits, a bystander type for later chapters (Velvet Heights). They respond to the trumpet slowly: they need a moment of music before they stop and come over, and they walk slower than the harbor locals.
- Teun and the mayor's aide: not written yet.

## Dialogue style guide

Scene length. An intro or outro runs 12 to 16 lines. Each scene has one job: chapter intros set up the danger and the goal of the level; outros give the result a feeling and point at the next chapter. End every outro on a hook.

Line length. One to three short sentences per line, about 160 characters at most. That fills five or six rows on a phone. The dialogue box grows to fit longer text, but a line that needs it is usually two lines. Never put two speakers in one line.

Narrator. A line without a speaker is narration, shown in italics with no name. Use it to open a scene, to set place and time, to move time forward, and to show action nobody would say aloud. Keep it in the present tense and concrete: what is seen and heard. Narration never explains how a player should feel and never gives game instructions; a character does that.

Pip's voice. Out loud, Pip is shy: short replies, "um", trailing off, apologizing. Inside, Pip is dry and quick. Inner thoughts are Pip lines written in brackets, for example "(There is no sock. There has never been a sock.)". Most jokes live in the inner voice, and the gap between the two voices is the joke. As the chapters go on, Pip's spoken lines get steadier and longer, and the bracketed doubts get rarer.

Quiet Squad humor. The officers are never cruel and never stupid. They are funny because they take the meters and the rules completely seriously: exact readings, invented section numbers ("Section 4, Subsection Shh"), procedure for everything, horror at small noises. They speak in calm, measured sentences. The Mayor is the same joke from above: she praises silence through loudspeakers.

Light and serious. Most lines are light. Each scene gets one or two serious beats that show the real cost: a fine for a friend, a lost instrument, someone arrested. Play those beats straight, with no joke in the same line, and let the next line lift the mood again. Chapters 4 and 5 lean more serious than the rest, as the outline says.

Staging. Put on stage only the characters who are physically present; voices from loudspeakers or radios speak from off stage, which dims everyone. Bring a character on with "enter" on the line where the story says they arrive, usually a narration line describing it, and take them off the same way. Keep Pip leftmost and at most four characters on stage at once. Backdrops: street for town scenes by day, night for town scenes at night, harbor for the quay, cellar for the Brass Cellar.

Drone and Partners. The surface of the game stays light and comic, but the corporation is cold and unsettling. Write it as calm, reasonable and efficient: memos, metrics, polite smiles, people described as productivity. Never make it cartoonishly evil (no cackling, no twirled moustaches, no stated wish to be evil), and never joke about it in its own scenes. Other characters may still be funny around it, as Officer Mute is when he wonders who his superiors are, but scenes inside Drone's world play straight. Hints come before proof: billboards and slips of the tongue in chapters 1 to 6, documents in chapter 7.

Mechanics in dialogue. When a chapter teaches something, a character says it in the world's terms (stay in the crowd, stay out of their sight lines, pick up your tips), never in button names.

Spelling. American English (harbor, neighbors, apologize).

## Visual style

Controlled places look controlled. Corporate and Quiet Squad ground is drawn in a gray, high-contrast noir style; music, and places won back by music, are vibrant color.

In levels, gray ground is a grayscale copy of the level with extra contrast. While Pip plays the trumpet, color spreads outward from him with the sound rings and fades when he stops. Each level marks zones that start gray or colored; a gray zone that allows it turns colored for the rest of the run once enough music has been played inside it. Pip and everything he wears are always in full color, so the player can always find him. Colored zones mark places that belong to the music: Pip's busking corner, the Brass Cellar's door.

In dialogue, the backdrop takes the scene's tone: gray for the Quiet Squad's streets and anything belonging to Drone and Partners, color for the Brass Cellar and other music places. Characters stay in color. A line can switch the tone, for example when the Squad arrives and the street goes gray, or when music returns. Use these switches for story beats, not decoration.

At night the screen is dark outside a small circle around Pip, the lamps' pools and the flashlight beams, so the player always reads where the light is. Light is danger: under a lamp Pip is seen from far away. Darkness sits on top of the noir look, so night streets are gray and dark, and a planted poster colors its wall.

Chapters 1 to 3 in practice: the busking corner where chapter 1 starts is colored, the rest of Main Street is gray; the harbor in chapter 2 starts gray and its three stretches can be won with music; the cellar door glows in color. The chapter 1 street backdrop shows a Drone and Partners billboard. Chapter 3's night street is gray except Pip's start by the cellar, and each poster colors the wall around it; the night backdrop also carries the billboard, dimly lit.
