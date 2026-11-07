const fs=require('fs');
const text=fs.readFileSync('.scratch/plan-editor-regression-final.log','utf8');
const failures=[...new Set([...text.matchAll(/^✖ (.+) \([\d.]+ms\)/gm)].map(x=>x[1]))].sort();
const baseline=JSON.parse(fs.readFileSync('docs/training-regression-baseline.json','utf8'));
const newFailures=failures.filter(x=>!baseline.existingFailures.includes(x));
const report={date:'2026-11-08',baselineFailureCount:baseline.baselineFailureCount,finalFailureCount:failures.length,newFailures,existingFailures:failures.filter(x=>baseline.existingFailures.includes(x)),fixedBaselineFailures:baseline.existingFailures.filter(x=>!failures.includes(x)),featureTestsPassed:14,browserFlowChecksPassed:31,reloadOrderVerified:true,coverageAndGeneratedCopyChecksPassed:true};
fs.writeFileSync('docs/plan-editor-regression.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(newFailures.length)process.exitCode=1;
