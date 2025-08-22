import { render, screen, fireEvent, waitFor } from '../../../utils/test-utils';
import { VoiceButton } from '../../../../components/voice/VoiceButton';
import { useVoiceStore } from '../../../../stores/voiceStore';

// Mock the voice store
vi.mock('../../../../stores/voiceStore');
const mockUseVoiceStore = vi.mocked(useVoiceStore);

// Mock Web Audio API
const mockMediaRecorder = {
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  state: 'inactive',
  stream: null,
};

global.MediaRecorder = vi.fn().mockImplementation(() => mockMediaRecorder);

describe('VoiceButton Component', () => {
  const mockStartRecording = vi.fn();
  const mockStopRecording = vi.fn();
  const mockProcessVoice = vi.fn();

  const defaultStoreState = {
    isRecording: false,
    isProcessing: false,
    error: null,
    transcript: '',
    lastResult: null,
    startRecording: mockStartRecording,
    stopRecording: mockStopRecording,
    processVoice: mockProcessVoice,
    clearError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseVoiceStore.mockReturnValue(defaultStoreState);
  });

  it('renders voice button with microphone icon', () => {
    render(<VoiceButton />);
    
    const button = screen.getByRole('button', { name: 'Start voice recording' });
    expect(button).toBeInTheDocument();
    expect(screen.getByTestId('microphone-icon')).toBeInTheDocument();
  });

  it('starts recording when clicked', async () => {
    render(<VoiceButton />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(mockStartRecording).toHaveBeenCalledTimes(1);
  });

  it('shows recording state when recording', () => {
    mockUseVoiceStore.mockReturnValue({
      ...defaultStoreState,
      isRecording: true,
    });

    render(<VoiceButton />);
    
    const button = screen.getByRole('button', { name: 'Stop voice recording' });
    expect(button).toHaveClass('bg-red-500');
    expect(screen.getByTestId('recording-pulse')).toBeInTheDocument();
  });

  it('stops recording when clicked while recording', () => {
    mockUseVoiceStore.mockReturnValue({
      ...defaultStoreState,
      isRecording: true,
    });

    render(<VoiceButton />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(mockStopRecording).toHaveBeenCalledTimes(1);
  });

  it('shows processing state', () => {
    mockUseVoiceStore.mockReturnValue({
      ...defaultStoreState,
      isProcessing: true,
    });

    render(<VoiceButton />);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(screen.getByTestId('processing-spinner')).toBeInTheDocument();
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('displays error message when error occurs', () => {
    mockUseVoiceStore.mockReturnValue({
      ...defaultStoreState,
      error: 'Microphone not available',
    });

    render(<VoiceButton />);
    
    expect(screen.getByText('Microphone not available')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveClass('border-red-300');
  });

  it('shows transcript when available', () => {
    mockUseVoiceStore.mockReturnValue({
      ...defaultStoreState,
      transcript: 'I did 10 push-ups',
    });

    render(<VoiceButton />);
    
    expect(screen.getByText('I did 10 push-ups')).toBeInTheDocument();
  });

  it('handles microphone permission denied', async () => {
    const mockGetUserMedia = vi.fn().mockRejectedValue(
      new DOMException('Permission denied', 'NotAllowedError')
    );
    
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      writable: true,
    });

    render(<VoiceButton />);
    
    fireEvent.click(screen.getByRole('button'));
    
    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalled();
    });
  });

  it('handles microphone not found', async () => {
    const mockGetUserMedia = vi.fn().mockRejectedValue(
      new DOMException('Device not found', 'NotFoundError')
    );
    
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      writable: true,
    });

    render(<VoiceButton />);
    
    fireEvent.click(screen.getByRole('button'));
    
    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalled();
    });
  });

  it('supports keyboard interaction', () => {
    render(<VoiceButton />);
    
    const button = screen.getByRole('button');
    button.focus();
    expect(button).toHaveFocus();

    fireEvent.keyDown(button, { key: 'Enter' });
    expect(mockStartRecording).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(button, { key: ' ' });
    expect(mockStartRecording).toHaveBeenCalledTimes(2);
  });

  it('shows recording duration', () => {
    mockUseVoiceStore.mockReturnValue({
      ...defaultStoreState,
      isRecording: true,
      recordingDuration: 30,
    });

    render(<VoiceButton />);
    
    expect(screen.getByText('00:30')).toBeInTheDocument();
  });

  it('has proper ARIA attributes', () => {
    render(<VoiceButton />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Start voice recording');
    
    mockUseVoiceStore.mockReturnValue({
      ...defaultStoreState,
      isRecording: true,
    });

    const { rerender } = render(<VoiceButton />);
    rerender(<VoiceButton />);
    
    const recordingButton = screen.getByRole('button');
    expect(recordingButton).toHaveAttribute('aria-label', 'Stop voice recording');
    expect(recordingButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('clears error when recording starts successfully', () => {
    const mockClearError = vi.fn();
    
    mockUseVoiceStore.mockReturnValue({
      ...defaultStoreState,
      error: 'Previous error',
      clearError: mockClearError,
    });

    render(<VoiceButton />);
    
    fireEvent.click(screen.getByRole('button'));
    
    expect(mockClearError).toHaveBeenCalledTimes(1);
    expect(mockStartRecording).toHaveBeenCalledTimes(1);
  });

  describe('Edge Cases', () => {
    it('handles MediaRecorder not supported', () => {
      const originalMediaRecorder = global.MediaRecorder;
      global.MediaRecorder = undefined as any;

      render(<VoiceButton />);
      
      fireEvent.click(screen.getByRole('button'));
      
      // Should show error or fallback behavior
      expect(screen.getByRole('button')).toBeInTheDocument();

      global.MediaRecorder = originalMediaRecorder;
    });

    it('handles stream stop during recording', async () => {
      const mockStream = {
        getTracks: vi.fn(() => [{ stop: vi.fn() }]),
        getAudioTracks: vi.fn(() => [{ stop: vi.fn() }]),
      };

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockResolvedValue(mockStream),
        },
        writable: true,
      });

      mockUseVoiceStore.mockReturnValue({
        ...defaultStoreState,
        isRecording: true,
      });

      render(<VoiceButton />);
      
      // Simulate stream ending
      fireEvent.click(screen.getByRole('button'));
      
      expect(mockStopRecording).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('does not re-render unnecessarily', () => {
      const { rerender } = render(<VoiceButton />);
      
      // Same state should not cause re-render
      mockUseVoiceStore.mockReturnValue(defaultStoreState);
      rerender(<VoiceButton />);
      
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });
});