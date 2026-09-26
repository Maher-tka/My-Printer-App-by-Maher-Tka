import type { BatchStudent, HardcoverProjectState } from '../types'

export function applyStudent(
  state: HardcoverProjectState,
  student: BatchStudent
): HardcoverProjectState {
  const academicYear =
    student.year.trim() || state.content.spine.year.trim() || state.content.front.academicYear

  return {
    ...state,
    content: {
      ...state.content,
      front: {
        ...state.content.front,
        studentName: student.studentName,
        title: student.title,
        department: student.department,
        supervisor: student.supervisor,
        academicYear
      },
      spine: {
        ...state.content.spine,
        studentName: student.studentName,
        shortTitle: student.spineTitle || student.title,
        year: academicYear
      }
    }
  }
}
