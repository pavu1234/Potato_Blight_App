export const DISCLAIMER='Simulation only. This duration is not a pesticide dose or real hardware command.';
export const PRODUCT='locally registered broad-spectrum protectant fungicide';
export const MIN_CONFIDENCE=0.8;
export function assess(s={}){
 const disease=['Early blight','Late blight','Healthy'].includes(s.disease)?s.disease:null;
 const confidence=Number.isFinite(s.confidence)&&s.confidence>=0&&s.confidence<=1?s.confidence:null;
 const o={disease,confidence,severityMode:s.mode==='phase2'?'Phase 2 — imported segmentation':'Phase 1 — classification only',severityBand:'Not measured',simulatedDuration:0,manualReview:true,agronomistReview:false,operatorConfirmed:!!s.operatorConfirmed,hardwareEnabled:false,recommendation:'No simulated spray. Review the leaf and diagnosis.',safetyDisclaimer:DISCLAIMER,reasons:[],canSimulate:false};
 if(!disease||confidence===null||!s.imageValid)o.reasons.push('A valid tomato-leaf classification is required.');
 if(confidence!==null&&confidence<MIN_CONFIDENCE)o.reasons.push('Disease confidence is below 80%.');
 if(s.quality!=='pass')o.reasons.push('Image-quality checks have not passed.');
 if(s.mode!=='phase2'){o.reasons.push('Phase 1 has no segmentation: severity is not measured.');return o;}
 const m=s.segmentation;
 const valid=m&&Number.isSafeInteger(m.visibleLeafPixels)&&Number.isSafeInteger(m.diseasedLeafPixels)&&m.visibleLeafPixels>0&&m.diseasedLeafPixels>=0&&m.diseasedLeafPixels<=m.visibleLeafPixels&&m.selection===s.selection&&Number.isFinite(m.confidence)&&m.confidence>=MIN_CONFIDENCE&&m.confidence<=1&&m.reviewed===true&&m.outsideLeafPixels===0;
 if(!valid){o.reasons.push('Matching, reviewed segmentation masks with confidence of at least 80% are required.');return o;}
 const p=m.diseasedLeafPixels/m.visibleLeafPixels*100;o.severityPercent=p;
 if(p===0){o.severityBand='Healthy';o.recommendation='No spray.';}
 else if(p<=5){o.severityBand='Very low';o.recommendation='Monitor and obtain manual review. No spray.';}
 else if(p<=10){o.severityBand='Low';o.simulatedDuration=2;}
 else if(p<=25){o.severityBand='Medium';o.simulatedDuration=5;}
 else if(p<=50){o.severityBand='High';o.simulatedDuration=8;o.agronomistReview=true;}
 else{o.severityBand='Critical';o.agronomistReview=true;o.recommendation='No automatic treatment. Manual and agronomist review required.';}
 if(disease==='Healthy'&&p>0||disease&&disease!=='Healthy'&&p===0)o.reasons.push('Classification and segmentation disagree; verify both.');
 if(o.reasons.length){o.simulatedDuration=0;o.recommendation='No simulated spray. Resolve the review items first.';return o;}
 o.manualReview=(p>0&&p<=5)||p>50;
 if(o.simulatedDuration>0){
  o.recommendation='Simulation category: '+PRODUCT+'. Actual product choice and application must follow the local label and agronomist approval.';
  if(o.agronomistReview&&!s.agronomistConfirmed){o.manualReview=true;o.reasons.push('Record agronomist review before the high-severity simulation.');}
  if(!Number.isFinite(s.waterLevel)||s.waterLevel<=0||s.waterLevel>100)o.reasons.push('Enter a non-empty manual tank level (above 0%, up to 100%).');
  if(!s.operatorConfirmed)o.reasons.push('Operator confirmation is required.');
  o.canSimulate=o.reasons.length===0&&!o.manualReview;
 }
 return o;
}
export function countMasks(leaf,disease){
 if(leaf.length!==disease.length||leaf.length%4)throw Error('Mask dimensions do not match.');
 let visibleLeafPixels=0,diseasedLeafPixels=0,outsideLeafPixels=0;
 for(let i=0;i<leaf.length;i+=4){
  const l=leaf[i+3]>127&&(leaf[i]+leaf[i+1]+leaf[i+2])/3>127;
  const d=disease[i+3]>127&&(disease[i]+disease[i+1]+disease[i+2])/3>127;
  if(l)visibleLeafPixels++;if(d&&l)diseasedLeafPixels++;if(d&&!l)outsideLeafPixels++;
 }
 if(!visibleLeafPixels)throw Error('Leaf mask contains no visible leaf pixels.');
 if(outsideLeafPixels)throw Error('Disease mask marks pixels outside the leaf mask.');
 return {visibleLeafPixels,diseasedLeafPixels,outsideLeafPixels};
}
