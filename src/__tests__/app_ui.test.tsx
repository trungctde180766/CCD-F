import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from '../App';
import { saveStoredAuthSession } from '../lib/auth';

describe('Full Application UI End-to-End Flow (Mandatory Auth Gate + All 6 Screens + Mobile Drawer)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('enforces mandatory authentication gate when not logged in, blocking access to questions', () => {
    render(<App />);

    expect(
      screen.getByText(/Bắt buộc đăng nhập để vào học và làm bài thi/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Đăng nhập để Bắt đầu Học/i)).toBeInTheDocument();
    // Questions and overview dashboard must NOT be accessible before login
    expect(screen.queryByText(/Bảng điều khiển tự học CCDV-F/i)).not.toBeInTheDocument();
    expect(screen.queryByText('ccdv-f-q001')).not.toBeInTheDocument();
  });

  it('renders Overview screen with 110 questions after login, navigates to Study mode, checks q001 and q078', () => {
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

    // 1. Overview screen checks
    expect(screen.getByText(/Bảng điều khiển tự học CCDV-F/i)).toBeInTheDocument();
    expect(screen.getByText(/0 \/ 110/i)).toBeInTheDocument();

    // 2. Navigate to Study Mode ("Học từng câu")
    fireEvent.click(screen.getByRole('button', { name: /Học từng câu/i }));
    expect(screen.getByText(/Question 1/i)).toBeInTheDocument();
    expect(screen.getByText('ccdv-f-q001')).toBeInTheDocument();

    // Anti-spoiler check: before clicking "Kiểm tra đáp án", explanation is not in DOM
    expect(screen.queryByText(/Correct answer from the source/i)).not.toBeInTheDocument();

    // Select option C on q001 and click "Kiểm tra đáp án"
    const optionCRadio = screen.getByLabelText(/Phương án C/i);
    fireEvent.click(optionCRadio);
    fireEvent.click(screen.getByRole('button', { name: /Kiểm tra đáp án/i }));

    // Verify correct feedback, source explanation, and per-option rationales appear
    expect(
      screen.getByText(/Chính xác! Bạn đã chọn đúng toàn bộ đáp án/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Correct answer from the source/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Giải thích chi tiết Vì sao Đúng \/ Vì sao Sai cho từng phương án/i)
    ).toBeInTheDocument();

    // Filter to 8 multiple-choice questions and test q078 (A, C)
    const filterSelect = screen.getByLabelText(/Lọc theo trạng thái câu hỏi/i);
    fireEvent.change(filterSelect, { target: { value: 'multiple_choice' } });

    expect(screen.getByText('ccdv-f-q078')).toBeInTheDocument();
    expect(screen.getAllByText(/Chọn nhiều đáp án/i).length).toBeGreaterThan(0);

    // Open mobile question drawer button and verify dialog renders
    const mobileDrawerBtn = screen.getByRole('button', { name: /Danh sách câu \(8\)/i });
    fireEvent.click(mobileDrawerBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Đóng bảng câu hỏi/i }));
  });

  it('runs a Mock Exam session for logged-in user with hidden answers until submission and records results in Review & Library', () => {
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

    // Verify timer and unanswered indicator appear, and answers are hidden
    expect(screen.getByRole('timer')).toBeInTheDocument();
    expect(screen.getByText(/Chưa trả lời: 30 câu/i)).toBeInTheDocument();
    expect(screen.queryByText(/Correct answer from the source/i)).not.toBeInTheDocument();

    // Click "Nộp bài" -> confirmation modal -> confirm submission
    fireEvent.click(screen.getByRole('button', { name: /^Nộp bài$/i }));
    expect(screen.getByText(/Xác nhận nộp bài thi thử\?/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận nộp bài ngay/i }));

    // After submission, exam result summary & explanation are visible
    expect(screen.getByText(/Điểm số:/i)).toBeInTheDocument();
    expect(screen.getByText(/Giải thích chi tiết từ nguồn/i)).toBeInTheDocument();

    // Navigate to Review ("Ôn câu sai & Nhắc ôn")
    fireEvent.click(screen.getByRole('button', { name: /Ôn câu sai & Nhắc ôn/i }));
    expect(screen.getByText(/Quy tắc nhắc ôn/i)).toBeInTheDocument();

    // Navigate to Library & Backup ("Thư viện & Sao lưu")
    fireEvent.click(screen.getByRole('button', { name: /Thư viện & Sao lưu/i }));
    expect(
      screen.getByText(/Thư viện toàn văn 110 câu hỏi \(ccdv-f-q001 đến ccdv-f-q110\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/110\/110 Hợp lệ/i)).toBeInTheDocument();
  });
});
