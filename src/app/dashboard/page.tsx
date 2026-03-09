import {
    RocketIcon,
    LockIcon,
    Tick01Icon,
    PlayIcon
} from 'hugeicons-react';

export default function UserDashboardPage() {
    return (
        <div className="space-y-10 max-w-7xl mx-auto">
            <div>
                <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground">My Learning</h1>
                <p className="text-muted-foreground mt-2 text-sm lg:text-base">Continue your training sessions and scheduled assessments.</p>
            </div>

            {/* Progress Tracker Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Active Session Card */}
                <div className="glass-card p-8 flex flex-col glass-card-hover group">
                    <div className="flex justify-between items-start mb-6">
                        <div className="space-y-3">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-foreground text-background shadow-sm">
                                In Progress
                            </span>
                            <h2 className="text-2xl font-bold tracking-tight">Enterprise Architecture 2026</h2>
                        </div>
                        <div className="p-3 bg-black/5 rounded-2xl group-hover:bg-foreground group-hover:text-background transition-colors duration-300">
                            <RocketIcon size={28} />
                        </div>
                    </div>

                    <p className="text-sm text-muted-foreground mb-10 leading-relaxed">
                        Learn the foundational principles of modern system design, microservices, and modular deployment strategies.
                    </p>

                    <div className="mt-auto space-y-5">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm font-semibold">
                                <span>Progress</span>
                                <span>60%</span>
                            </div>
                            <div className="w-full h-2 bg-black/5 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-foreground rounded-full transition-all duration-1000 ease-out"
                                    style={{ width: '60%' }}
                                />
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-2">
                            <span className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                                <Tick01Icon size={16} className="text-foreground" />
                                3 / 5 Modules Completed
                            </span>
                            <button className="px-6 py-2.5 text-sm font-semibold rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-colors focus:ring-2 focus:ring-ring focus:outline-none flex items-center gap-2 active:scale-95">
                                <PlayIcon size={16} />
                                Resume
                            </button>
                        </div>
                    </div>
                </div>

                {/* Locked Exam Session */}
                <div className="glass-card p-8 flex flex-col bg-white/30 border-dashed border-2">
                    <div className="flex justify-between items-start mb-6">
                        <div className="space-y-3">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-black/5 text-muted-foreground">
                                Locked Assessment
                            </span>
                            <h2 className="text-2xl font-bold tracking-tight text-muted-foreground">Advanced Security Audit (Exam)</h2>
                        </div>
                        <div className="p-3 bg-black/5 rounded-2xl text-muted-foreground/50">
                            <LockIcon size={28} />
                        </div>
                    </div>

                    <p className="text-sm text-muted-foreground mb-10 leading-relaxed">
                        The final exam will be unlocked once you complete all prerequisite training modules. Safe Exam Browser (SEB) is mandatory.
                    </p>

                    <div className="mt-auto pt-6 border-t border-black/5 flex items-start gap-3">
                        <div className="mt-0.5">
                            <LockIcon size={18} className="text-muted-foreground" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">Please complete "Enterprise Architecture 2026" first to unlock this assessment.</span>
                    </div>
                </div>

            </div>
        </div>
    );
}
