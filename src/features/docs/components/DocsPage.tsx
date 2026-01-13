import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function DocsPage() {
    const handleScrollTo = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
        e.preventDefault();
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-100px)]">
            <div className="flex flex-col py-8 my-4 gap-1 flex-none">
                <h1 className="text-xl font-bold tracking-tight">Documentation</h1>
                <p className="text-muted-foreground">Learn how to use Minerva v2 effectively.</p>
            </div>

            <div className="grid gap-8 md:grid-cols-[200px_1fr] h-full overflow-hidden">
                <aside className="hidden md:flex flex-col gap-2 flex-none">
                    <nav className="grid gap-2.5 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2">
                        <a
                            href="#introduction"
                            onClick={(e) => handleScrollTo(e, 'introduction')}
                            className="text-sm font-medium hover:underline text-foreground"
                        >
                            Introduction
                        </a>
                        <a
                            href="#getting-started"
                            onClick={(e) => handleScrollTo(e, 'getting-started')}
                            className="text-sm text-muted-foreground hover:underline"
                        >
                            Getting Started
                        </a>
                        <a
                            href="#account"
                            onClick={(e) => handleScrollTo(e, 'account')}
                            className="text-sm text-muted-foreground hover:underline"
                        >
                            Account & Security
                        </a>
                        <a
                            href="#schedules"
                            onClick={(e) => handleScrollTo(e, 'schedules')}
                            className="text-sm text-muted-foreground hover:underline"
                        >
                            Managing Schedules
                        </a>
                        <a
                            href="#settings"
                            onClick={(e) => handleScrollTo(e, 'settings')}
                            className="text-sm text-muted-foreground hover:underline"
                        >
                            Settings
                        </a>
                        <a
                            href="#troubleshooting"
                            onClick={(e) => handleScrollTo(e, 'troubleshooting')}
                            className="text-sm text-muted-foreground hover:underline"
                        >
                            Troubleshooting
                        </a>
                        <a
                            href="#export-import"
                            onClick={(e) => handleScrollTo(e, 'export-import')}
                            className="text-sm text-muted-foreground hover:underline"
                        >
                            Export & Import
                        </a>
                        <a
                            href="#faq"
                            onClick={(e) => handleScrollTo(e, 'faq')}
                            className="text-sm text-muted-foreground hover:underline"
                        >
                            FAQ
                        </a>
                        <a
                            href="#support"
                            onClick={(e) => handleScrollTo(e, 'support')}
                            className="text-sm text-muted-foreground hover:underline"
                        >
                            Contact & Support
                        </a>
                    </nav>
                </aside>

                <div className="h-full overflow-y-auto pr-6 scroll-smooth">
                    <div className="space-y-10 pb-20">
                        {/* Introduction */}
                        <section id="introduction" className="space-y-4">
                            <div>
                                <h2 className="text-lg font-semibold tracking-tight mb-2">Introduction</h2>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Minerva v2 is a powerful schedule management tool designed to help you organize, resolve conflicts, and export schedule data efficiently.
                                    Built with modern web technologies, it offers a seamless experience for managing complex scheduling needs.
                                </p>
                            </div>
                        </section>

                        <Separator />

                        {/* Getting Started */}
                        <section id="getting-started" className="space-y-4">
                            <div>
                                <h2 className="text-lg font-semibold tracking-tight mb-2">Getting Started</h2>
                                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                                    To get started with Minerva, you'll need to create an account or sign in. Here is a quick overview of the main concepts:
                                </p>
                                <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
                                    <Card className="shadow-none">
                                        <CardHeader>
                                            <CardTitle className="text-sm font-medium">Schedules</CardTitle>
                                            <CardDescription className="text-xs text-muted-foreground">
                                                Individual entries representing a class, meeting, or event. These contain time, location, and assignee information.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>

                                        </CardContent>
                                    </Card>
                                    <Card className="shadow-none">
                                        <CardHeader>
                                            <CardTitle className="text-sm font-medium">Conflicts</CardTitle>
                                            <CardDescription className="text-xs text-muted-foreground">
                                                When two schedules overlap in time and location or assignee. Minerva automatically detects these for you.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>

                                        </CardContent>
                                    </Card>
                                    <Card className="shadow-none">
                                        <CardHeader>
                                            <CardTitle className="text-sm font-medium">Profile</CardTitle>
                                            <CardDescription className="text-xs text-muted-foreground">
                                                Your personal account settings, display name, and security options.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>

                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </section>

                        <Separator />

                        {/* Account & Security */}
                        <section id="account" className="space-y-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <h2 className="text-lg font-semibold tracking-tight">Account & Security</h2>
                                    <Badge variant="outline">New</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                                    Manage your account settings and security from the Profile page.
                                </p>

                                <h3 className="text-sm font-semibold mb-2">Creating an Account</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                                    Click "Sign up" on the login page. You'll receive a 6-digit verification code via email to confirm your account.
                                    Enter the code to complete registration and access the dashboard.
                                </p>

                                <h3 className="text-sm font-semibold mb-2">Updating Your Display Name</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                                    Go to <strong>Profile → Account Information</strong> to change your display name.
                                    This is the name shown across the application.
                                </p>

                                <h3 className="text-sm font-semibold mb-2">Changing Your Password</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                                    Go to <strong>Profile → Security</strong>. For security, you must enter your current password
                                    before setting a new one. Passwords must be at least 8 characters long.
                                </p>

                                <h3 className="text-sm font-semibold mb-2">Forgot Password?</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                                    Click "Forgot password?" on the login page. You'll receive a verification code via email.
                                    Enter the code to verify your identity, then set a new password.
                                </p>
                            </div>
                        </section>

                        <Separator />

                        {/* Managing Schedules */}
                        <section id="schedules" className="space-y-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <h2 className="text-lg font-semibold tracking-tight">Managing Schedules</h2>
                                    <Badge variant="secondary">Core Feature</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                                    The Dashboard is where you view and manipulate your schedule data.
                                </p>

                                <h3 className="text-sm font-semibold mb-2">Importing Data</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                                    Click the "Upload Files" button to import Excel files. Supported formats include .xlsx and .xls.
                                    Ensure your columns match the expected format (Date, Time, Location, etc.).
                                </p>

                                <h3 className="text-sm font-semibold mb-2">Auto Assign</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                                    Use the "Auto Assign" feature to automatically distribute unassigned schedules to available slots or personnel based on predefined rules.
                                </p>
                            </div>
                        </section>

                        <Separator />

                        {/* Settings */}
                        <section id="settings" className="space-y-4">
                            <div>
                                <h2 className="text-lg font-semibold tracking-tight mb-2">Settings</h2>
                                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                                    Customize your experience in the Settings page.
                                </p>
                                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                                    <li><strong>Appearance:</strong> Toggle between Light, Dark, or System theme.</li>
                                    <li><strong>Language:</strong> Choose your preferred language (English, Spanish, French).</li>
                                    <li><strong>Export Path:</strong> Choose where your schedule exports are saved by default.</li>
                                    <li><strong>Auto Save:</strong> Enable or disable automatic saving of your work to local storage.</li>
                                    <li><strong>Clear Cache:</strong> Reset the application state if you encounter issues.</li>
                                </ul>
                            </div>
                        </section>

                        <Separator />

                        {/* Troubleshooting */}
                        <section id="troubleshooting" className="space-y-4">
                            <div>
                                <h2 className="text-lg font-semibold tracking-tight mb-2">Troubleshooting</h2>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    If you run into issues, try the following:
                                </p>
                                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2 mt-2">
                                    <li>Check your internet connection for features that sync with the server.</li>
                                    <li>Use "Clear Cache" in Settings to reset local data.</li>
                                    <li>Ensure your input Excel files are not corrupted and follow the correct format.</li>
                                    <li>If you can't log in, try the "Forgot password?" flow to reset your credentials.</li>
                                    <li>Contact support if issues persist after trying these steps.</li>
                                </ul>
                            </div>
                        </section>

                        <Separator />

                        {/* Export & Import */}
                        <section id="export-import" className="space-y-4">
                            <div>
                                <h2 className="text-lg font-semibold tracking-tight mb-2">Export & Import</h2>
                                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                                    Minerva supports importing and exporting schedule data in Excel format.
                                </p>

                                <h3 className="text-sm font-semibold mb-2">Supported Formats</h3>
                                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2 mb-4">
                                    <li><strong>.xlsx</strong> - Excel 2007+ (recommended)</li>
                                    <li><strong>.xls</strong> - Legacy Excel format</li>
                                </ul>

                                <h3 className="text-sm font-semibold mb-2">Import Requirements</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed mb-2">
                                    Your Excel file should contain the following columns:
                                </p>
                                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2 mb-4">
                                    <li><strong>Date</strong> - The date of the schedule entry</li>
                                    <li><strong>Time</strong> - Start and/or end time</li>
                                    <li><strong>Location</strong> - Where the event takes place</li>
                                    <li><strong>Assignee</strong> - Person or resource assigned (optional)</li>
                                </ul>

                                <h3 className="text-sm font-semibold mb-2">Export Options</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    You can configure your default export path in Settings → Storage & Export.
                                    Enable "Quick Export" to skip the file dialog and save directly.
                                </p>
                            </div>
                        </section>

                        <Separator />

                        {/* FAQ */}
                        <section id="faq" className="space-y-4">
                            <div>
                                <h2 className="text-lg font-semibold tracking-tight mb-2">Frequently Asked Questions</h2>

                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-sm font-semibold mb-1">Why can't I edit my email address?</h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            Your email is tied to your account identity and is used for authentication.
                                            For security reasons, email changes require contacting support.
                                        </p>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-semibold mb-1">I didn't receive my verification code. What should I do?</h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            Check your spam/junk folder first. If it's not there, wait a few minutes and try
                                            clicking "Resend" to get a new code. Make sure you entered the correct email.
                                        </p>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-semibold mb-1">How do I report a bug or request a feature?</h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            Use the Contact & Support section below to reach our team.
                                            Please include as much detail as possible about the issue.
                                        </p>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-semibold mb-1">Is my data secure?</h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            Yes. We use industry-standard encryption and your data is stored securely.
                                            Passwords are hashed and never stored in plain text.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <Separator />

                        {/* Contact & Support */}
                        <section id="support" className="space-y-4">
                            <div>
                                <h2 className="text-lg font-semibold tracking-tight mb-2">Contact & Support</h2>
                                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                                    Need help? We're here for you.
                                </p>

                                <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                                    <Card className="shadow-none">
                                        <CardHeader>
                                            <CardTitle className="text-sm font-medium">📧 Email Support</CardTitle>
                                            <CardDescription className="text-xs text-muted-foreground">
                                                For general inquiries and support requests.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-sm text-primary">support@minerva-app.com</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="shadow-none">
                                        <CardHeader>
                                            <CardTitle className="text-sm font-medium">🐛 Report Issues</CardTitle>
                                            <CardDescription className="text-xs text-muted-foreground">
                                                Found a bug? Let us know so we can fix it.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-sm text-primary">bugs@minerva-app.com</p>
                                        </CardContent>
                                    </Card>
                                </div>

                                <p className="text-xs text-muted-foreground mt-4">
                                    Response times are typically within 24-48 business hours.
                                </p>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
