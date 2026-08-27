"use client";

import { useState } from "react";

export function AddUserFields({
  teachers,
}: {
  teachers: { id: string; name: string; classroom: string }[];
}) {
  const [role, setRole] = useState("COORDINATOR");

  return (
    <>
      <select
        name="role"
        value={role}
        onChange={(event) => setRole(event.target.value)}
        className="w-full rounded-xl border border-line px-3 py-2"
      >
        <option value="COORDINATOR">Bus Coordinator</option>
        <option value="FRONT_DESK">Reception</option>
        <option value="ADMINISTRATOR">Admin</option>
        <option value="TEACHER">Teacher</option>
        <option value="BUS_COMPANY">Bus Company</option>
        <option value="BUS_ASSISTANT">Bus Assistant</option>
      </select>
      {role === "TEACHER" ? (
        <label className="block text-sm">
          Which class should this teacher see?
          <select name="teacherId" required className="mt-1 w-full rounded-xl border border-line px-3 py-2">
            <option value="">Choose the teacher / class</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.classroom ? `${teacher.name} · ${teacher.classroom}` : teacher.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="teacherId" value="" />
      )}
      {role === "BUS_ASSISTANT" ? (
        <input
          name="assignedBus"
          required
          placeholder="Bus number"
          className="w-full rounded-xl border border-line px-3 py-2"
        />
      ) : (
        <input type="hidden" name="assignedBus" value="" />
      )}
    </>
  );
}
