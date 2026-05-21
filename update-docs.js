import fs from 'fs';
import path from 'path';

const sessionPath = './docs/session.md';
const handoffPath = './docs/handoff.md';

function getTimestamp() {
  return new Date().toISOString();
}

function updateDocs() {
  if (!fs.existsSync(sessionPath)) {
    console.error('session.md not found');
    return;
  }

  let sessionContent = fs.readFileSync(sessionPath, 'utf8');

  // Count checklist items
  const checkRegex = /-\s+\[([x\s/])\]\s+(.+)/g;
  let match;
  let total = 0;
  let completed = 0;
  let inProgress = 0;

  while ((match = checkRegex.exec(sessionContent)) !== null) {
    total++;
    const marker = match[1];
    if (marker === 'x') {
      completed++;
    } else if (marker === '/') {
      inProgress++;
    }
  }

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  console.log(`Progress: ${completed}/${total} completed (${inProgress} in progress). Completion: ${completionRate}%`);

  // Update progress indicator in session.md
  // Let's add or update a progress header in session.md
  const progressHeader = `## Progress Indicator\n\n- **Status**: ${completionRate}% Completed\n- **Last Updated**: ${getTimestamp()}\n- **Completed Tasks**: ${completed} of ${total}\n- **In Progress Tasks**: ${inProgress}\n`;

  if (sessionContent.includes('## Progress Indicator')) {
    // Replace existing block
    const parts = sessionContent.split('## Progress Indicator');
    const remainingParts = parts[1].split('## ');
    remainingParts[0] = `\n\n- **Status**: ${completionRate}% Completed\n- **Last Updated**: ${getTimestamp()}\n- **Completed Tasks**: ${completed} of ${total}\n- **In Progress Tasks**: ${inProgress}\n\n`;
    sessionContent = parts[0] + '## Progress Indicator' + remainingParts.join('## ');
  } else {
    // Append after introduction or session goals
    const goalsIdx = sessionContent.indexOf('## Session Goals');
    if (goalsIdx !== -1) {
      sessionContent = sessionContent.slice(0, goalsIdx) + progressHeader + '\n' + sessionContent.slice(goalsIdx);
    } else {
      sessionContent = progressHeader + '\n' + sessionContent;
    }
  }

  fs.writeFileSync(sessionPath, sessionContent, 'utf8');
  console.log('Updated session.md successfully!');

  // Also update handoff.md with last updated timestamp and progress
  if (fs.existsSync(handoffPath)) {
    let handoffContent = fs.readFileSync(handoffPath, 'utf8');
    
    // Remove old last documented line and its leading blank lines if they exist
    handoffContent = handoffContent.replace(/\r?\n\r?\n\*Last documented state update: .* \| Progress: .*%\*\r?\n?/g, '');
    
    const handoffMeta = `\n\n*Last documented state update: ${getTimestamp()} | Progress: ${completionRate}%*\n`;
    
    // Add meta at the top below header
    const firstLineIdx = handoffContent.indexOf('\n');
    if (firstLineIdx !== -1) {
      handoffContent = handoffContent.slice(0, firstLineIdx) + handoffMeta + handoffContent.slice(firstLineIdx);
    }
    
    fs.writeFileSync(handoffPath, handoffContent, 'utf8');
    console.log('Updated handoff.md successfully!');
  }
}

updateDocs();
