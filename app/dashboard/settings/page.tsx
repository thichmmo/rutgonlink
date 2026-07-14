import {getServerSession} from 'next-auth';
import {authOptions} from '@/lib/auth-options';
import {redirect} from 'next/navigation';
import {User} from 'lucide-react';
import {prisma} from '@/lib/prisma';
import ChangePasswordForm from './ChangePasswordForm';
import ChangeNameForm from './ChangeNameForm';
import ApiKeySection from './ApiKeySection';
import FolderRotationSection from './FolderRotationSection';

export default async function SettingsPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) redirect('/login');

    const user = await prisma.user.findUnique({
        where: {email: session.user.email},
        select: {apiKey: true, password: true},
    });

    const apiKey: string | null = user?.apiKey ?? null;
    const hasPassword = !!user?.password;

    return (
        <div className="space-y-6 min-w-0">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Cài đặt</h1>
                <p className="text-gray-600 text-sm mt-1">Quản lý tài khoản và tùy chọn</p>
            </div>

            {/* Profile */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
                <h2 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
                    <User className="w-5 h-5 text-sky-600" />
                    Thông tin tài khoản
                </h2>
                <div className="space-y-4">
                    <ChangeNameForm initialName={session.user.name || ''} />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                        <input
                            defaultValue={session.user.email || ''}
                            type="email"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-gray-50"
                            readOnly
                        />
                    </div>
                </div>
            </div>

            <ApiKeySection initialApiKey={apiKey} />

            <FolderRotationSection />

            {hasPassword && <ChangePasswordForm />}
        </div>
    );
}
