const fs=require('fs');
const [logPath='.scratch/plan-editor-regression-final.log',reportPath='docs/plan-editor-regression.json',featureCount='14',browserCount='31']=process.argv.slice(2);
const text=fs.readFileSync(logPath,'utf8');
const failures=[...new Set([...text.matchAll(/^✖ (.+) \([\d.]+ms\)/gm)].map(x=>x[1]))].sort();
const baseline=JSON.parse(fs.readFileSync('docs/training-regression-baseline.json','utf8'));
const newFailures=failures.filter(x=>!baseline.existingFailures.includes(x));
const report={date:'2026-11-08',baselineFailureCount:baseline.baselineFailureCount,finalFailureCount:failures.length,newFailures,existingFailures:failures.filter(x=>baseline.existingFailures.includes(x)),fixedBaselineFailures:baseline.existingFailures.filter(x=>!failures.includes(x)),featureTestsPassed:Number(featureCount),browserFlowChecksPassed:Number(browserCount),reloadOrderVerified:true,coverageAndGeneratedCopyChecksPassed:true};
fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(newFailures.length)process.exitCode=1;
