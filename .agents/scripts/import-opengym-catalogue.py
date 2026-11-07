# -*- coding: utf-8 -*-
"""Build a reviewed, text-only catalogue update from a pinned openGym snapshot.
Run fetch-opengym-source.py first. No runtime network requests or media imports.
"""
import copy,json,pathlib,re,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[2]
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
config=read(ROOT/'.agents/scripts/opengym-selection.json')
sha=config['commit']; cache=ROOT/'.scratch/opengym-source/catalogue/exercises'
original=read(ROOT/'.agents/fixtures/exercise-library-v1.json')
extract="const fs=require('fs'),vm=require('vm');const s=fs.readFileSync('index.html','utf8');const m=s.match(/const EXERCISE_GUIDES = ([\\s\\S]*?);\\r?\\n/);process.stdout.write(JSON.stringify(vm.runInNewContext('('+m[1]+')')));"
guides={g['id']:g for g in json.loads(subprocess.check_output(['node','-e',extract],cwd=ROOT).decode('utf-8'))}
packed=read(ROOT/'训练动作库/upstream-opengym.json')['exercises'] if (ROOT/'训练动作库/upstream-opengym.json').exists() else {}
def source_for(ident):
    p=cache/(ident+'.json')
    return read(p) if p.exists() and p.stat().st_size else packed.get(ident)
data=copy.deepcopy(original)

# Local descriptions are reviewed instructions, not a blind translation of upstream claims.
new_text={
'0025':('仰卧在平凳上，用杠铃完成水平推举。主要训练胸部，肩前侧和肱三头肌参与。','平凳置于稳固架内，脚掌踩稳，握距略宽于肩，手腕保持稳定。|收紧躯干，保持上背稳定，将杠铃移至胸部上方。|受控下放到自己可控的胸部附近，不反弹或强压肩部。|向上推回，身体保持稳定；结束后稳妥回架。'),
'0289':('在平凳上用两只哑铃完成卧推，左右手独立控制负重。','仰卧稳固平凳，双脚踩稳，将哑铃置于胸部两侧。|收紧躯干，手腕位于前臂上方，肘部保持可控角度。|向上推起至手臂接近伸直，不相撞哑铃。|慢慢降回可控深度，不借下落反弹。'),
'0314':('在上斜训练凳上完成哑铃卧推，胸部锁骨部和肩前侧参与较多。','调整稳固上斜凳，坐稳后将哑铃带到胸部两侧。|双脚踩地，保持背部和骨盆稳定。|沿自然轨迹推起，不耸肩或互撞哑铃。|慢慢回到可控幅度；凳角度与负重以个人活动范围为限。'),
'0375':('仰卧持一只哑铃完成肩关节上拉，胸部与背阔肌共同参与；不是单纯肱三头伸展。','沿稳固平凳仰卧，双脚踩地，双手稳握哑铃。|手臂在胸上方，肘微屈并保持角度相对稳定。|向头后方缓慢移动，在肩部可控范围内停住，不塌腰追求深度。|沿原轨迹拉回胸上方，保持负重始终受控。'),
'0493':('双手置于高于地面的稳固支撑上完成俯卧撑，区别于脚抬高版本。','确认台面稳定，将双手置于台边略宽于肩。|双脚向后移动，身体从头到脚保持连贯。|屈肘让胸部接近支撑边缘，不塌腰或耸肩。|推回起始位置；支撑高度可按能力调整。'),
'3211':('双膝支地的俯卧撑变式，以较短支撑杠杆练习水平推举。','双手略宽于肩，双膝支撑在软垫上。|从头部到膝部保持整体稳定，不只弯腰。|屈肘下放胸部至可控位置。|推回，避免头部先抬起或腰部下沉。'),
'3294':('宽距支撑下向一侧移重完成俯卧撑，另一侧手臂提供辅助支撑。','双手宽距支地，躯干收紧。|将胸部受控移向一侧手掌，该侧屈肘，另一侧手臂相对伸直。|只下降到肩部可控的范围，不强迫直臂侧过伸。|推回中间再换侧；左右次数分别记录。'),
'4075':('站姿双手持弹力带完成水平夹胸，胸部发力，动作区别于推举。','将弹力带可靠固定在身体后方约胸部高度。|站稳并收紧躯干，双臂张开，肘微屈。|保持肘角相对稳定，将双手向胸前合拢。|受控打开，不让弹力带突然把肩部拉向后方。'),
'1430':('在双杠上屈肘下降再撑起，胸部和肱三头肌参与，躯干可轻微前倾。','确认双杠稳固，双手支撑身体，肩部保持主动稳定。|轻微前倾，屈肘下放到个人肩部能控制的深度。|避免耸肩、突然下坠或强压到极深位置。|伸肘撑起；不能控制全程时采用辅助版本。'),
'1162':('站姿严格杠铃肩上推举，以肩部和肱三头肌完成上推，不用腿部弹震借力。','双脚站稳，杠铃位于肩前，手腕和前臂对齐。|收紧腹部与臀部，保持躯干稳定。|把杠铃沿靠近身体的路径推到头顶，不后仰顶腰。|受控降回肩前，负重超过控制能力时停止。'),
'0426':('站姿哑铃肩上推举，以躯干主动稳定控制两只哑铃。','双脚站稳，收紧腹部与臀部。|哑铃置于肩侧，手腕保持稳定。|向上推到手臂接近伸直，不蹬腿或后仰顶腰。|慢慢下放至可控高度。'),
'0404':('掌心相对的坐姿哑铃肩推；握法与普通坐姿肩推不同。','坐稳并支撑背部，双手掌心相对持哑铃于肩侧。|收紧躯干，保持肘部在身体前侧的自然位置。|向上推起，不改变为大幅后仰。|受控降回，保持掌心相对。'),
'0396':('坐姿向侧方抬起哑铃，主要训练肩部，减少腿部摆动借力。','坐稳，双脚踩地，双手持哑铃自然垂下。|肘微屈，手臂沿略靠前的侧方抬起。|到个人可控高度即可，不用耸肩甩起。|慢慢回落，保持左右节奏一致。'),
'0921':('上臂相对稳定时向外转动肩关节，训练肩袖外旋功能；人体图归入肩部大区。','弹力带固定在身体一侧，使用轻阻力。|肘屈约直角，上臂靠近躯干，可用薄毛巾辅助定位。|保持肘位置，前臂缓慢向外旋转，不转动整个躯干。|受控返回，避免弹力带突然拉回。'),
'0924':('上臂相对稳定时向内转动肩关节，训练肩袖内旋功能；不以大负重摆动代替旋转。','弹力带固定在身体一侧，站姿稳定。|屈肘约直角，上臂靠近躯干，肩部不耸起。|在不移动肘部的前提下，前臂向腹部方向旋转。|受控回到起点，不用躯干扭转借力。'),
'1017':('持弹力带将手臂抬成Y形，训练肩部和上背的协同控制。','双脚稳固踩住弹力带或按器材要求固定。|双手持带，躯干稳定，手臂略在身体前方。|向前上方抬成Y形，避免塌腰或耸肩抢动作。|受控降回，阻力以能保持姿势为准。'),
'0032':('从地面以髋伸和腿部发力提起杠铃，臀部、腿后侧和躯干稳定肌参与。','杠铃靠近小腿，双脚站稳，屈髋屈膝握杠。|收紧躯干，保持脊柱在可控位置。|蹬地并伸髋站起，让杠铃靠近身体，不猛拽或后仰。|先屈髋再适度屈膝，受控把杠铃放回地面。'),
'3593':('杠铃背负深蹲，以膝髋协同屈伸训练大腿和臀部。','在带保护杆的稳固深蹲架内设置杠位。|杠铃放在可稳定承托的上背部，双脚站稳。|收紧躯干，屈髋屈膝下蹲至个人可控深度，膝部沿脚尖方向移动。|脚掌持续踩稳，站起后再稳妥回架。'),
'1060':('上背靠凳、杠铃置于髋前完成臀推，重点练习伸髋。','将凳固定，上背靠凳，髋前杠铃加垫。|双脚踩稳，颈部保持自然，躯干收紧。|伸髋抬起，顶部大腿与躯干接近连线，不用腰部过伸顶高。|缓慢下降，保持杠铃和凳稳定。'),
'1581':('向后迈步再回到站姿的弓步蹲，前侧腿承担主要起身工作。','站稳，双脚约髋宽。|一脚向后迈出，双膝屈曲，前脚全掌保持支撑。|下蹲到可控位置，骨盆和膝部保持稳定。|前侧腿发力回到站姿，再换侧。'),
'3928':('以单腿支撑完成徒手髋铰链，训练腿后侧、臀部与平衡控制。','单脚站稳，支撑膝微屈。|保持骨盆朝向地面，屈髋使躯干向前、另一腿向后。|背部保持可控，幅度以平衡和髋活动范围为限。|支撑侧伸髋回到站姿，左右分别记录。'),
'4031':('站姿对抗弹力带把腿移向身体外侧，训练髋外展肌群。','弹力带可靠固定在低处并连接训练侧踝部。|扶稳支撑，躯干直立，支撑腿微屈。|训练腿向外侧移动，不侧倒躯干或大幅旋转骨盆。|缓慢回收，换侧重复；左右次数分别记录。'),
'4029':('站姿对抗弹力带把腿移向身体中线，训练髋内收肌群。','弹力带固定在低处并连接训练侧踝部。|侧身站稳并扶好支撑，训练腿从外侧起始。|受控向中线方向内收，不用躯干侧倒代偿。|慢慢回到外侧，换侧重复；左右次数分别记录。'),
'0911':('俯卧对抗弹力带屈膝，主要训练腘绳肌。','将弹力带可靠固定在低位，连接踝部，俯卧于垫上。|保持骨盆贴稳，腹部轻收。|屈膝把脚跟向臀部方向移动，不抬髋顶腰。|受控伸膝，避免弹力带猛拉。'),
'1004':('环形弹力带置于双膝上方的深蹲变式，保持大腿和臀部协同控制。','将合适阻力的环带放在双膝上方，双脚站稳。|保持膝盖沿脚尖方向，屈髋屈膝下蹲。|幅度以脚掌稳定、躯干可控为限，不刻意过度把膝盖向外顶。|站起回到初始姿势，保持环带受控。'),
'6607':('在环形弹力带阻力下侧向迈步，训练髋外展控制。','环带按动作设置放在腿部，双脚分开保持轻张力。|屈髋屈膝成小幅半蹲，躯干稳定。|向一侧迈出一小步，另一脚随后跟进，不完全并脚放松。|在可控范围往返，记录左右方向实际步数。'),
'1513':('弹力带阻力下的髋铰链，训练腿后侧、臀部及躯干稳定。','使用适合此动作的弹力带，脚下踩稳，另一端安置于上背而非颈部。|膝微屈，收紧躯干。|臀部向后移动，屈髋使上身前倾，背部保持可控。|伸髋站回，不向后甩腰。'),
'0909':('弓步站姿配合弹力带阻力完成下蹲和起身，训练大腿与臀部。','按动作要求稳妥踩住或固定弹力带，采用前后站姿。|保持前脚全掌支撑，骨盆稳定。|屈髋屈膝下蹲，前膝沿脚尖方向移动。|受控站回；完成一侧后换侧。'),
'4442':('后脚抬高、手扶稳固支撑的分腿蹲，减少平衡限制。','后脚置于稳固低凳，前脚站稳，一手轻扶支撑。|保持骨盆和躯干稳定，主要用前侧腿承重。|屈膝屈髋下降到可控深度，避免后腿大力蹬凳。|前侧腿发力回到起点，左右分别完成。'),
'6560':('双腿在坐姿中各屈曲约直角，练习髋部旋转位置的温和拉伸。','坐在垫上，一腿在前、一腿在侧后，双膝屈曲。|可用手支撑身体，保持在自己能控制的位置。|温和前倾或保持，不强压膝盖追求角度。|自然呼吸，完成后缓慢换侧。'),
'1379':('坐姿屈膝提踵，训练小腿，屈膝姿势下比目鱼肌参与突出。','坐稳，前脚掌踩地或稳固垫块，膝部约屈直角。|将哑铃用手扶稳放于大腿靠近膝部的位置，避免压在关节骨点。|抬起脚跟，短暂停住，不用身体起伏借力。|慢慢下放到可控范围。'),
'1178':('单腿支撑并持哑铃提踵，训练小腿跖屈力量。','单腿站稳，一手持哑铃，另一手可轻扶支撑。|支撑腿保持自然伸展，脚掌稳定。|抬高脚跟，避免脚踝向内或向外翻。|受控下降，左右分别记录次数；重量为所持哑铃总重量。'),
'1246':('仰卧抬起肩部和腿部保持中空姿势，训练腹部对躯干位置的控制。','仰卧，收紧腹部，让腰背保持可控贴近垫面。|轻抬肩部与双腿，双手可先放在体侧。|仅在不塌腰的情况下逐渐伸长手臂或腿部杠杆。|保持自然呼吸，姿势失控前结束计时。'),
'5649':('保持中空姿势做小幅整体摇摆，区别于静止的中空保持。','先建立能稳定维持的中空姿势。|保持躯干和腿部相对形状不变，整体小幅前后摇动。|避免用腰部反复屈伸或甩腿制造幅度。|回到起始方向为一次完整摇摆，失去控制时停止。'),
'0979':('面对来自侧方的弹力带阻力向前推手，训练躯干抗旋转控制。','弹力带固定于身体侧方约胸部高度。|双手将带柄握在胸前，双脚站稳。|向前推手，保持骨盆和胸部朝向不被拉转。|受控收回胸前；转身换另一朝向练习。'),
'6211':('仰卧交替屈膝和躯干旋转，训练腹部和腹斜肌。','仰卧，抬腿屈髋屈膝，双手轻扶头侧，不拉颈。|肩部轻抬，一侧腿伸出，躯干向另一侧旋转。|以相反肘和膝靠近为动作方向，不强求碰到。|慢慢交替；左右分别记录，保持腰背可控。'),
'4170':('四点跪姿抬膝离地保持，训练核心和肩部支撑控制。','双手在肩下，双膝在髋下，脚趾踩地。|收紧腹部，膝盖抬离地面少许。|保持背部与骨盆稳定，不耸肩塌腰。|自然呼吸，姿势改变前结束保持。'),
'0133':('屈膝侧桥，用前臂和膝部支撑身体，训练侧向躯干稳定。','侧卧屈膝，肘部位于肩下，前臂支撑。|抬起髋部，让肩、髋、膝形成稳定连线。|避免向前后滚转或耸肩。|保持呼吸，完成一侧后换侧并分别计时。'),
'0867':('面朝上的平板保持，用手掌和脚跟支撑，臀部及身体后侧参与。','坐姿双手置于身后，支撑方向以手腕能控制为限。|双脚向前伸，脚跟踩稳。|抬髋至躯干与腿部接近连线，不仰头或用腰猛拱。|保持自然呼吸，受控落回坐姿。'),
'1326':('掌心朝向自己的反握引体，背部和肱二头肌共同完成上拉。','双手反握稳固单杠，身体悬垂，肩部保持主动控制。|收紧躯干，屈肘将身体拉向杠。|在可控幅度内上拉，不甩腿或伸颈硬凑高度。|受控下降，不突然坠入肩部。'),
'0253':('使用窄距平行握把、掌心相对的引体向上。','双手握住稳固平行握把，身体悬垂。|稳定肩部与躯干，屈肘向上拉。|保持自然头位，不摆荡借力。|受控下降到个人可控范围。'),
'4718':('用弹力带托住脚或膝部辅助完成反握引体，辅助量随拉伸长度变化。','检查弹力带完好并可靠固定在单杠，稳妥进入辅助位置。|反握单杠，收紧躯干，避免弹力带滑脱。|屈肘上拉，不甩腿或依赖突然回弹。|受控下降并安全退出；记录弹力带规格，不虚构辅助公斤数。')
}
templates={
'push':('chest','triceps,deltoids'),'shoulder':('deltoids','triceps'),'pull':('upper-back','biceps,forearm'),'arms':('biceps','forearm'),'legs':('quadriceps,gluteal','hamstring'),'core':('abs','obliques'),'recovery':('','')}
specific={
'lateral-raise':('deltoids','trapezius'),'single-arm-lateral-raise':('deltoids','trapezius'),'band-lateral-raise':('deltoids','trapezius'),'front-raise':('deltoids',''),
'db-curl':('biceps','forearm'),'hammer-curl':('biceps,forearm',''),'triceps-overhead':('triceps',''),
'rdl':('hamstring,gluteal','lower-back'),'db-calf-raise':('calves',''),'leg-raise':('hip-flexors','abs'),'reverse-crunch':('abs','hip-flexors'),
'side-plank':('obliques','abs,deltoids'),'dead-bug':('abs','hip-flexors'),'russian-twist':('obliques','abs'),'bird-dog':('abs','gluteal,lower-back'),
'short-bridge':('gluteal','hamstring'),'table-bridge':('gluteal','hamstring,deltoids'),'high-low-bridge':('gluteal,lower-back','deltoids'),
'scapular-pushup':('serratus','deltoids'),'scapular-pull':('trapezius','upper-back'),'pull-up-hold':('upper-back','biceps,forearm'),
'band-face-pull':('deltoids,upper-back','trapezius'),'reverse-fly':('deltoids,upper-back','trapezius'),'hanging-knee-raise':('hip-flexors','abs,forearm'),'dead-hang-grip':('forearm','upper-back'),
'upper-body-stretch':('chest,upper-back,deltoids',''),'adductor-stretch':('adductors',''),'chest-stretch':('chest',''),'lat-stretch':('upper-back',''),'hip-flexor-stretch':('hip-flexors','quadriceps')}
split=lambda x:[v for v in x.split(',') if v]
time_keys={'crow-stand','pull-up-hold','short-plank','plank','side-plank','dead-hang-grip','brisk-walk','walk'}
side_keys={'single-arm-lateral-raise','single-arm-db-row','bulgarian-split-squat','offset-squat','assisted-single-leg-half-squat','assisted-single-leg-squat-box','side-plank','dead-bug','bird-dog','russian-twist'}
reference_keys={'deep-pushup','decline-deep-pushup','mechanical-drop-pushup','eccentric-pullup','short-plank','plank','single-arm-db-row','single-arm-lateral-raise','pullup-or-band-pulldown','leg-raise'}
corrections={
'db-shoulder-press':('本条按坐姿哑铃肩推描述，旧名称“哑铃肩推”保留为别名；站姿版本使用独立条目。','坐在稳固训练凳上，双脚踩地，背部自然贴靠。|哑铃位于肩侧，手腕保持稳定。|向上推至手臂接近伸直，不借腿部弹震或顶腰。|慢慢回到可控位置，保持肩部稳定。'),
'wide-pushup':('双手比肩稍宽的俯卧撑，主要训练胸大肌，肩前侧和肱三头肌辅助；不能把它理解为孤立训练“外侧胸”。','双手比肩稍宽支地，身体保持整体稳定。|屈肘受控下放，手距和肘角以肩部能控制为准。|在不塌腰、不过度耸肩的前提下推回。|避免极宽手距和突然下坠。'),
'pike-pushup':('屈髋呈倒V形的俯卧撑，偏重肩部和肱三头肌；基础版本不要求双脚抬高。','双手撑地，臀部抬高，身体呈倒V形。|保持躯干受控，屈肘让头部向双手之间略前方下降。|在肩颈可控范围内停住，不用头部承重。|伸肘推回，避免突然塌肩或强压颈部。'),
'scapular-pull':('肘部保持接近伸直，通过肩胛带小幅运动抬升、下放躯干；与静态主动悬垂不同。','握住稳固单杠，身体悬垂，肘部保持接近伸直。|不屈肘做完整引体，通过肩胛控制让躯干小幅上移。|短暂停住后受控回到起始位置。|按动态重复记次数；单纯保持悬垂应使用计时动作。'),
'leg-raise':('仰卧屈髋抬腿，髋屈肌负责抬腿，腹部帮助控制骨盆和腰椎位置。','仰卧在垫上，腹部收紧，腰背位置保持可控。|根据能力伸直或适度屈膝，缓慢抬腿。|下放到不导致腰部明显拱起的范围。|不甩腿，不把髋屈动作描述为孤立“下腹”训练。'),
'russian-twist':('坐姿进行受控躯干旋转的核心动作，区别于帕洛夫推举等抗旋转保持动作。','坐稳并屈膝，躯干保持可控位置，双脚可以踩地。|双手放于胸前，从躯干转向一侧，不只甩手。|回中间再转向另一侧，动作幅度保持舒适。|避免弓背大幅甩转；记录时明确左右往返的次数口径。')
}
report=[];snapshot={}
for a in data['actions']:
    before=copy.deepcopy(a);key=a['exerciseKey'];g=guides.get(key,{})
    guide=copy.deepcopy(a.get('guide') or {'diagram':g.get('diagram',''),'cautions':g.get('cautions',[])})
    guide['diagram']=re.sub(r'本周[^\n，。；]*[，。；]?','',guide.get('diagram',''))
    guide['cautions']=[x for x in guide.get('cautions',[]) if not any(w in x for w in ['本周','今天'])]
    if key in corrections:
        a['description'],steps=corrections[key];guide['diagram']='\n'.join(steps.split('|'))
    else:
        a['description']=a['displayName']+'的通用动作说明；训练剂量、次数和强度以当天计划及实际能力为准。'
    a['instructions']=[re.sub(r'^(起始|下降|下放|推起|抬起|支撑|动作|顶部|底部)[：:]','',x).strip() for x in guide['diagram'].splitlines() if x.strip()]
    if not guide['cautions']:guide['cautions']=['器材与支撑物必须稳固，动作保持受控。','出现疼痛、眩晕或失去姿势控制时停止，不勉强追求幅度。']
    a['guide']=guide
    primary,secondary=specific.get(key,templates[a['category']]);a['primaryMuscles']=split(primary);a['secondaryMuscles']=split(secondary)
    a['movementTags']=copy.deepcopy(before.get('muscleGroups',[]))
    a['muscleGroups']=[] # Populated with canonical display names below.
    a['recordingMode']='time' if key in time_keys or a['category']=='recovery' else 'reps'
    a['laterality']='unilateral' if key in side_keys else 'bilateral'
    a['exerciseType']='choice' if key=='pullup-or-band-pulldown' else 'cardio' if key in ['walk','brisk-walk'] else 'mobility' if a['category']=='recovery' else 'strength'
    equipment=['dumbbell'] if ('db-' in key or key in ['rdl','goblet-squat','lateral-raise','front-raise','single-arm-lateral-raise','hammer-curl','triceps-overhead','reverse-fly']) else ['band'] if 'band' in key else ['pull-up-bar'] if key in ['pullup','eccentric-pullup','pull-up-hold','scapular-pull','hanging-knee-raise','dead-hang-grip'] else ['bodyweight']
    if key=='db-fly':equipment.append('bench')
    if key=='db-shoulder-press':
        a['displayName']='坐姿哑铃肩推';a['aliases']=list(dict.fromkeys(a['aliases']+['坐姿哑铃肩推']));equipment.append('bench')
    a['equipment']=equipment;a['englishName']='';a['replaceAliases']=True
    match=re.search(r'/([0-9]+)\.gif$',a.get('media',{}).get('path',''))
    src=source_for(match[1]) if match else None
    # Shared/approximate media IDs are not asserted to be exact metadata matches.
    exact=bool(src and key not in reference_keys and not key.startswith('custom'))
    a['mediaMatch']='exact' if exact else 'reference'
    a['provenance']={'project':'openGym + 本地原有指南','commit':sha,'checkedAt':'2026-11-07','upstreamId':src['id'] if exact else None,'url':f'https://github.com/DuarteSantos8/openGym/blob/{sha}/catalogue/exercises/{src["id"]}.json' if src else f'https://github.com/DuarteSantos8/openGym/blob/{sha}/catalogue/README.md','license':'本地修订文本；上游引用分别遵循 AGPL-3.0 或原始 ExerciseDB MIT 条款','note':'保留本地稳定键；已拆分肌群、动作功能与计划剂量。'+('与上游元数据对照；媒体授权独立。' if exact else '本地变式或组合项；没有断言与上游为一一对应。')}
    if src:
        snapshot[src['id']]=src
        if exact:a['englishName']=src['name']
    if key=='scapular-pull':a['aliases']=[x for x in a['aliases'] if '沉肩悬垂' not in x]+['Scapular Pull-up']
    if key=='wide-pushup':a['aliases']=[x for x in a['aliases'] if x!='宽距']
    report.append((before,a))

for row in config['selected']:
    ident,name,category,primary,secondary,equipment,pattern,*optional=row
    src=source_for(ident);assert src and src['id']==ident
    description,steps=new_text[ident]
    if ident=='0375':primary='chest,upper-back';secondary='triceps'
    if ident=='1017':primary='deltoids';secondary='trapezius,upper-back'
    side=optional[0] if optional else ('unilateral' if ident in ['4031','4029'] else 'bilateral')
    mode=optional[1] if len(optional)>1 else 'reps'
    a={'exerciseKey':'opengym-'+ident,'displayName':name,'englishName':src['name'],'aliases':[name,src['name']],'category':category,'muscleGroups':[],'primaryMuscles':split(primary),'secondaryMuscles':split(secondary),'movementTags':[pattern],'normalizationTags':[pattern,'opengym'],'equipment':split(equipment),'recordingMode':mode,'laterality':side,'exerciseType':'mobility' if category=='recovery' else 'strength','description':description,'instructions':steps.split('|'),'guide':{'diagram':'\n'.join(steps.split('|')),'cautions':['器材与支撑固定可靠，使用能全程控制的负重与幅度。','出现疼痛或姿势失控时停止，不依赖反弹或身体甩动完成。']},'media':None,'mediaMatch':'none','status':'confirmed','provenance':{'project':'openGym','upstreamId':ident,'commit':sha,'checkedAt':'2026-11-07','url':f'https://github.com/DuarteSantos8/openGym/blob/{sha}/catalogue/exercises/{ident}.json','license':'AGPL-3.0（本地中文审校文本）；原始 ExerciseDB 文本按上游逐项标识保留 MIT','note':'中文步骤已结合上游描述逐项整理；不包含上游图片、动画或其热链。'}}
    snapshot[ident]=src;data['actions'].append(a)

names={'chest':'胸大肌','deltoids':'三角肌','upper-back':'背阔与上背肌群','trapezius':'斜方肌','serratus':'前锯肌','biceps':'肱二头肌','triceps':'肱三头肌','forearm':'前臂肌群','abs':'腹直肌','obliques':'腹斜肌','lower-back':'下背肌群','gluteal':'臀肌群','quadriceps':'股四头肌','hamstring':'腘绳肌','adductors':'内收肌群','hip-flexors':'髋屈肌群','calves':'小腿肌群','tibialis':'胫前肌'}
for a in data['actions']:
    a['muscleGroups']=[names[k] for k in a['primaryMuscles']]
    if '的通用动作说明；' in a['description']:
        focus='、'.join(a['muscleGroups']) or ('低强度活动与恢复' if a['category']=='recovery' else '全身协同')
        cue=a['instructions'][0].rstrip('。') if a['instructions'] else ''
        a['description']=a['displayName']+'，主要涉及'+focus+'。'+cue+'。具体用量按当天计划记录。'
data.update(schemaVersion=2,revision='2026-11-07',source='本地68条审校 + openGym固定提交文本参考；新增42条，无上游媒体导入',upstreamCommit=sha)
(ROOT/'训练动作库/actions.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT/'训练动作库/muscle-regions.json').write_text(json.dumps({'schemaVersion':1,'regions':names},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT/'训练动作库/upstream-opengym.json').write_text(json.dumps({'commit':sha,'source':'https://github.com/DuarteSantos8/openGym','notice':'Text metadata only. Per-entry textSource and upstream NOTICE apply. No media.','exercises':snapshot},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
lines=['# 动作库审校与新增清单','','日期：2026-11-07。原有68条全部检查；新增42条，当前110条。','',f'固定提交：`{sha}`。不包含上游图片、动画。','', '## 原有动作逐项审校','','|稳定键|动作|原肌群标签|修订后主练肌群|处理|','|---|---|---|---|---|']
for before,after in report:
    detail='修正具体步骤与概念' if before['exerciseKey'] in corrections else '保留可用步骤，补齐/规范字段'
    if any('本周' in x for x in [before.get('guide',{}).get('diagram','')]+before.get('guide',{}).get('cautions',[])):detail+='；移出周特定用量'
    lines.append('|'+before['exerciseKey']+'|'+before['displayName']+'|'+ '、'.join(before.get('muscleGroups',[]))+'|'+'、'.join(after['muscleGroups'])+'|'+detail+'|')
lines+=['','## 修订前后示例','']
for key in corrections:
    old,new=next((x,y) for x,y in report if x['exerciseKey']==key)
    lines+=['### '+new['displayName'],'','原肌群：'+'、'.join(old.get('muscleGroups',[])),'','修订后：'+new['description'],'','步骤：'+'；'.join(new['instructions']),'']
lines+=['## 新增动作','','|上游ID|中文名|原名|器材|计量|','|---|---|---|---|---|']
for a in data['actions'][68:]:lines.append('|'+a['provenance']['upstreamId']+'|'+a['displayName']+'|'+a['englishName']+'|'+','.join(a['equipment'])+'|'+a['recordingMode']+' / '+a['laterality']+'|')
lines+=['','## 保留与未作断言','','- 历史 exerciseKey 保留，组合项不擅自分配到某个动作。','- 肩袖内/外旋归入肩部图形大区，文字描述仍区分旋转袖功能。','- 原有媒体对应为轨迹参考的保留提示，未因文件存在就认定已获授权。','- 原始元数据中的宽泛或绝对效果描述未直接照搬。人体图只是记录分类。','- 现有历史未重新标注；新库的肌群解释版本记录在逐组条目中。','']
(ROOT/'docs/exercise-library-audit.md').write_text('\n'.join(lines),encoding='utf-8')
print('Wrote',len(data['actions']),'actions;',len(snapshot),'upstream metadata snapshots; original keys preserved.')
