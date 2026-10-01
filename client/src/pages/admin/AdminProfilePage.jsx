import toast from "react-hot-toast";
import AvatarUpload from "../../components/AvatarUpload.jsx";
import { StatusBadge } from "../../components/ui/index.jsx";
import useAuth from "../../hooks/useAuth.js";
import { profilesApi } from "../../api/endpoints.js";

/**
 * An admin isn't a marketplace participant (no TeacherProfile/StudentProfile
 * of their own), so unlike teacher/student/parent this page has nothing to
 * upsert beyond the photo itself — see profiles.service.js's updateMyPhoto.
 */
const AdminProfilePage = () => {
  const { user, refreshUser } = useAuth();

  const savePhoto = async (photoUrl) => {
    await profilesApi.updateMyPhoto(photoUrl);
    await refreshUser();
    toast.success(photoUrl ? "Photo updated" : "Photo removed");
  };

  return (
    <div className="flex flex-col gap-6" style={{ maxWidth: 640 }}>
      <div className="card flex flex-col gap-6 p-7">
        <div className="flex flex-col gap-1">
          <h2 className="serif text-2xl">Your profile</h2>
          <span className="text-sm text-ink-2">Shown in the admin console header. Not part of the public marketplace.</span>
        </div>
        <AvatarUpload name={user.name} src={user.photoUrl} size={96} onUploaded={savePhoto} onRemove={() => savePhoto(null)} />
      </div>

      <div className="card flex flex-col gap-0 p-7">
        <div className="mb-3 flex flex-col gap-1">
          <h2 className="serif text-2xl">Account</h2>
          <span className="text-sm text-ink-2">Contact support to change your email or phone.</span>
        </div>
        {[
          ["Name", user.name],
          ["Email", user.email, user.emailVerified],
          ["Mobile", user.phone, user.phoneVerified],
        ].map(([label, value, verified]) => (
          <div key={label} className="flex flex-wrap items-center justify-between gap-3 border-t border-mist py-4">
            <div className="flex min-w-0 flex-col gap-[3px]">
              <span className="text-[13px] text-ink-2">{label}</span>
              <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                {value}
                {verified && <StatusBadge status="approved" label="✓ Verified" />}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminProfilePage;
