// Semantic screen, not a validated botanical detector. Reject ambiguous inputs.
export const LEAF_LABELS = [
 'a close-up photograph of a single healthy plant leaf',
 'a close-up photograph of a diseased plant leaf with spots',
 'a close-up photograph of a dry brown plant leaf',
 'a close-up photograph of a tomato plant leaf'
];
export const OTHER_LABELS = [
 'a human face or a selfie', 'a person standing or sitting indoors',
 'a hand or other human body part', 'a room with furniture',
 'a computer screen or a screenshot of a website',
 'a phone, laptop or electronic device', 'a drone or a toy',
 'a car, bike or other vehicle', 'an animal or a bird',
 'food, vegetables or fruit', 'a flower', 'a tree or a forest',
 'a wide aerial photograph of a farm or field',
 'grass or a lawn', 'a building or a road', 'soil, rocks or bare ground',
 'clothing or patterned fabric', 'a green plastic object',
 'a drawing, printed text or a document', 'a blank or very dark photograph',
 'an everyday household object'
];
export const LABELS = [...LEAF_LABELS, ...OTHER_LABELS];
export function assessLeaf(scores) {
 if(!Array.isArray(scores)||scores.length!==LABELS.length)return {status:'uncertain'};
 const map=new Map(scores.map(x=>[x.label,x.score]));
 if(map.size!==LABELS.length||LABELS.some(x=>!Number.isFinite(map.get(x))||map.get(x)<0||map.get(x)>1))return {status:'uncertain'};
 const leaf=LEAF_LABELS.map(x=>map.get(x)),other=OTHER_LABELS.map(x=>map.get(x));
 const leafTotal=leaf.reduce((a,b)=>a+b,0),leafBest=Math.max(...leaf),otherBest=Math.max(...other);
 // Scores are relative to these prompts, not calibrated probabilities.
 if(leafTotal>=.80 && leafBest>=3*otherBest)return {status:'leaf'};
 if(otherBest>leafBest && leafTotal<.20)return {status:'not-leaf'};
 return {status:'uncertain'};
}
