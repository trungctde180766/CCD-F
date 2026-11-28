import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from '../App';
import { saveStoredAuthSession } from '../lib/auth';

describe('Full Application UI End-to-End Flow (Mandatory Auth Gate + Persistent Study Stage + Reset + Exam)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('enforces mandatory authentication gate when not logged in, blocking access to questions', () => {
    render(<App />);

    expect(
      screen.getByText(/Bắt buộc đăng nhập để vào học và làm bài thi/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Đăng nhập để Bắt đầu Học/i)).toBeInTheDocument();
    expect(screen.queryByText(/Bảng điều khiển tự học CCDV-F/i)).not.toBeInTheDocument();
    expect(screen.queryByText('ccdv-f-q001')).not.toBeInTheDocument();
  });

  it('persists Study Mode exact question & checked stage across browser close/reopen, and supports Reset from Question 1', () => {
    saveStoredAuthSession({
      token: 'test-token-hocvien01',
      user: {
        username: 'hocvien01',
        displayName: 'Học Viên 01',
        role: 'user',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      },
    });

    const { unmount } = render(<App />);

    // Dual-course switcher and Library & Backup tab should be available
    expect(screen.getByRole('button', { name: /Developer \(CCDV-F\) \(110c\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Associate \(CCAO-F\) \(169c\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thư viện & Sao lưu/i })).toBeInTheDocument();

    // Navigate to Study Mode ("Học từng câu")
    fireEvent.click(screen.getByRole('button', { name: /Học từng câu/i }));
    expect(screen.getByText('ccdv-f-q001')).toBeInTheDocument();

    // Select C on Q1 and check
    fireEvent.click(screen.getByLabelText(/Phương án C/i));
    fireEvent.click(screen.getByRole('button', { name: /Kiểm tra đáp án/i }));
    expect(
      screen.getByText(/Chính xác! Bạn đã chọn đúng toàn bộ đáp án/i)
    ).toBeInTheDocument();

    // Move to Question 2 (ccdv-f-q002) and select option B WITHOUT checking yet
    fireEvent.click(screen.getByRole('button', { name: /Câu tiếp/i }));
    expect(screen.getByText('ccdv-f-q002')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Phương án B/i));

    // Simulate closing the browser tab and reopening!
    unmount();
    render(<App />);

    // Should automatically resume directly on Study Mode at Question 2 (ccdv-f-q002) with Option B still selected!
    expect(screen.getByText('ccdv-f-q002')).toBeInTheDocument();
    const reopenedOptionB = screen.getByLabelText(/Phương án B/i) as HTMLInputElement;
    expect(reopenedOptionB.checked).toBe(true);

    // Click "Làm lại từ đầu (Reset)" -> Reset back to Question 1
    fireEvent.click(screen.getByRole('button', { name: /Làm lại từ đầu \(Reset\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /1\. Làm lại lượt Học từng câu từ Câu 1/i }));
    expect(screen.getAllByText('ccdv-f-q001').length).toBeGreaterThan(0);
    expect(screen.getByText(/Question 1/i)).toBeInTheDocument();
  });

  it('runs a Mock Exam session with hidden answers until submission, supports Reset & records results in Review', () => {
    saveStoredAuthSession({
      token: 'test-token-hocvien01',
      user: {
        username: 'hocvien01',
        displayName: 'Học Viên 01',
        role: 'user',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      },
    });

    render(<App />);

    // Navigate to Mock Exam ("Thi thử")
    fireEvent.click(screen.getByRole('button', { name: /^Thi thử$/i }));
    expect(screen.getAllByText(/Cấu hình luyện tập/i).length).toBeGreaterThan(0);

    // Start exam with default 30 questions / 45 minutes / 80%
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu Thi thử/i }));

    // Verify timer, Reset button, and hidden answers
    expect(screen.getByRole('timer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset thi lại/i })).toBeInTheDocument();
    expect(screen.queryByText(/Giải thích chi tiết/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Correct answer from the source/i)).not.toBeInTheDocument();

    // Submit exam
    fireEvent.click(screen.getByRole('button', { name: /^Nộp bài$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận nộp bài ngay/i }));

    expect(screen.getByText(/Điểm số:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Thi lại đề này từ Câu 1/i })).toBeInTheDocument();

    // Navigate to Review ("Ôn câu sai & Nhắc ôn")
    fireEvent.click(screen.getByRole('button', { name: /Ôn câu sai & Nhắc ôn/i }));
    expect(screen.getByText(/Quy tắc nhắc ôn/i)).toBeInTheDocument();
  });

  it('allows hand-picking individual questions into a saved custom exam pack, launching a mock exam with those exact questions, and persisting across reload', () => {
    saveStoredAuthSession({
      token: 'test-token-hocvien01',
      user: {
        username: 'hocvien01',
        displayName: 'Học Viên 01',
        role: 'user',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      },
    });

    const { unmount } = render(<App />);

    // Open Mock Exam tab and switch to "Tự chọn câu & Gói đề"
    fireEvent.click(screen.getByRole('button', { name: /^Thi thử$/i }));
    fireEvent.click(screen.getByRole('tab', { name: /Tự chọn câu & Gói đề/i }));

    // Hand-pick 3 specific questions: Q1, Q5, Q87
    fireEvent.click(screen.getByLabelText(/Chọn Câu 1 \(ccdv-f-q001\)/i));
    fireEvent.click(screen.getByLabelText(/Chọn Câu 5 \(ccdv-f-q005\)/i));
    fireEvent.click(screen.getByLabelText(/Chọn Câu 87 \(ccdv-f-q087\)/i));

    expect(screen.getByText(/Đã chọn: 3 \/ 110 câu/i)).toBeInTheDocument();

    // Name the pack & turn off shuffle so order is deterministic
    fireEvent.change(screen.getByLabelText(/Tên gói đề thi thử/i), {
      target: { value: 'Gói tủ 3 câu' },
    });
    const shuffleCheckbox = screen.getByLabelText(/Đảo thứ tự câu khi thi/i) as HTMLInputElement;
    if (shuffleCheckbox.checked) {
      fireEvent.click(shuffleCheckbox);
    }

    // Save & start exam immediately
    fireEvent.click(screen.getByRole('button', { name: /Lưu & Thi thử ngay \(3 câu\)/i }));

    // Verify exam started with title "Gói tủ 3 câu", 3 questions, starting at Q1
    expect(screen.getByText('Gói tủ 3 câu')).toBeInTheDocument();
    expect(screen.getByText('ccdv-f-q001')).toBeInTheDocument();
    expect(screen.getByText(/Câu 1 \/ 3/i)).toBeInTheDocument();

    // Next -> Q5, Next -> Q87
    fireEvent.click(screen.getByRole('button', { name: /Câu tiếp/i }));
    expect(screen.getByText('ccdv-f-q005')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Câu tiếp/i }));
    expect(screen.getByText('ccdv-f-q087')).toBeInTheDocument();

    // Submit & exit back to Exam config, reload app, and verify saved pack persisted!
    fireEvent.click(screen.getByRole('button', { name: /^Nộp bài$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận nộp bài ngay/i }));
    fireEvent.click(screen.getByRole('button', { name: /Tạo đề thi mới/i }));

    unmount();
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /^Thi thử$/i }));
    fireEvent.click(screen.getByRole('tab', { name: /Tự chọn câu & Gói đề/i }));
    expect(screen.getByText('Gói tủ 3 câu')).toBeInTheDocument();
    expect(screen.getByText(/Gói đề thi thử đã lưu \(1\)/i)).toBeInTheDocument();
  });
});
