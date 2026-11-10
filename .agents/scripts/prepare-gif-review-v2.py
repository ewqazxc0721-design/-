# -*- coding: utf-8 -*-
"""Assemble an AI keyframe sheet as an isolated, unapproved review candidate."""
from pathlib import Path
from PIL import Image
import argparse
import json
import shutil

parser = argparse.ArgumentParser()
parser.add_argument('image', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
folder = root / 'media-review/2026-11-10'
if (folder / 'approval-receipt.json').exists():
    raise SystemExit('This review has approved assets; prepare any further draft in a new versioned review folder.')
stem = 'kneeling-pushup-ai-v2'
shutil.copy2(args.image, folder / f'{stem}-spritesheet.png')
sheet = Image.open(args.image).convert('RGB')
# The generated sheet contains lowering keyframes; reverse them for exact return poses.
frames = []
for index in range(8):
    col, row = index % 4, index // 4
    box = (round(col * sheet.width / 4), round(row * sheet.height / 2),
           round((col + 1) * sheet.width / 4), round((row + 1) * sheet.height / 2))
    frames.append(sheet.crop(box).resize((360, 360), Image.Resampling.LANCZOS))
sequence = frames + list(reversed(frames[1:-1]))
durations = [140] * len(sequence)
durations[0] = durations[7] = 400
sequence[0].save(folder / f'{stem}.gif', save_all=True, append_images=sequence[1:],
                 duration=durations, loop=0, optimize=True, disposal=2)
sequence[0].save(folder / f'{stem}.webp', save_all=True, append_images=sequence[1:],
                 duration=durations, loop=0, quality=84, method=6)
sequence[0].save(folder / f'{stem}-poster.webp', quality=84, method=6)
review_path = folder / 'review.json'
review = json.loads(review_path.read_text(encoding='utf-8'))
review['approved'] = False
review['userDirection'] = {
    'decision': 'refine_ai_style_without_import',
    'style': 'match_existing_grayscale_anatomical_assets',
    'muscleHighlight': True,
    'productionImportApproved': False,
    'message': '继续完善 A 的 AI 风格，暂不入库；AI 动作最好和现有素材一致，可以高亮训练肌肉群。'
}
for sample in review['samples']:
    sample['label'] = {'ai-knee': 'A1', 'existing-knee': 'B', 'existing-bench': 'C'}.get(sample['id'], sample.get('label', ''))
    if sample['id'].startswith('existing-'):
        sample['status'] = 'reference_only'
        sample['note'] = '仅作现有素材风格对照。用户选择继续完善 AI 方案，没有批准此素材入库。'
sample = {
    'id': 'ai-knee-v2', 'label': 'A2', 'ai': True, 'exerciseKey': 'opengym-3211',
    'name': '跪姿俯卧撑 · 解剖风格与肌群高亮',
    'gif': f'{stem}.gif', 'webp': f'{stem}.webp', 'poster': f'{stem}-poster.webp',
    'source': '内置 image_gen 参考现有图解生成关键帧，往返合成循环；未入库、未发布。',
    'status': 'pending_review',
    'note': '白底灰色解剖人物、黑色短裤。深红为胸肌，浅红为肱三头肌与肩前束；仅示意肌群，颜色不代表发力强度。关键帧间仍有轻微轮廓变化，供风格和动作复审；尚未批准入库。',
    'bytes': (folder / f'{stem}.gif').stat().st_size
}
review['samples'] = [sample] + [s for s in review['samples'] if s['id'] != sample['id']]
review_path.write_text(json.dumps(review, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'sheet': list(sheet.size), 'frames': len(sequence),
    'durationMs': sum(durations), 'gifBytes': sample['bytes'],
    'webpBytes': (folder / f'{stem}.webp').stat().st_size,
    'posterBytes': (folder / f'{stem}-poster.webp').stat().st_size,
    'approved': False}, ensure_ascii=False))
