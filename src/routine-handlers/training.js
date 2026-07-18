// [Neuro-Weaver] Neurofeedback Training Mode routine events.
// `training_start` lets a routine JSON kick off a course at a scripted time.
// `training_checkpoint` is emitted by TrainingEngine as objectives are passed
// (also authorable directly in a routine as a narrative marker).
// `training_end` is emitted on course completion/failure and drives routine
// auto-branching via the course's `onSuccessRoutine` / `onFailRoutine` sub-routine names.
export function registerTrainingHandlers(handlers, player) {
    handlers.set('training_start', (evt) => {
        if (!player.trainingEngine) {
            console.warn('[Training] No TrainingEngine attached to player; cannot start course.');
            return;
        }
        player.trainingEngine.startCourse(evt.course);
    });

    handlers.set('training_checkpoint', (evt) => {
        console.log(`[Training] Checkpoint reached: ${evt.label || evt.index}`);
        if (evt.message) {
            player.executeEvent({ type: 'text', message: evt.message, duration: evt.duration || 2.0 });
        }
    });

    handlers.set('training_end', (evt) => {
        const branchName = evt.success ? evt.autoBranchSuccess : evt.autoBranchFail;
        if (branchName && player.subRoutines[branchName]) {
            console.log(`[Training] Auto-branching into sub-routine: ${branchName}`);
            player.playNow(player.subRoutines[branchName]);
        }
    });
}
