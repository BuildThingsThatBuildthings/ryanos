import { render, screen, fireEvent } from '../../../utils/test-utils';
import { WorkoutCard } from '../../../../components/workout/WorkoutCard';
import { createMockWorkout } from '../../../utils/fixtures/api-responses';
import { WorkoutStatus } from '../../../../types';

describe('WorkoutCard Component', () => {
  const mockOnStart = vi.fn();
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();

  const defaultProps = {
    workout: createMockWorkout(),
    onStart: mockOnStart,
    onEdit: mockOnEdit,
    onDelete: mockOnDelete,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders workout information correctly', () => {
    const workout = createMockWorkout({
      name: 'Test Workout',
      description: 'Test description',
      date: '2023-01-01',
      status: WorkoutStatus.PLANNED,
    });

    render(<WorkoutCard {...defaultProps} workout={workout} />);

    expect(screen.getByText('Test Workout')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
    expect(screen.getByText('Jan 1, 2023')).toBeInTheDocument();
  });

  it('displays correct status badge', () => {
    const plannedWorkout = createMockWorkout({ status: WorkoutStatus.PLANNED });
    const { rerender } = render(<WorkoutCard {...defaultProps} workout={plannedWorkout} />);
    
    expect(screen.getByText('Planned')).toBeInTheDocument();
    expect(screen.getByText('Planned')).toHaveClass('bg-gray-100');

    const inProgressWorkout = createMockWorkout({ status: WorkoutStatus.IN_PROGRESS });
    rerender(<WorkoutCard {...defaultProps} workout={inProgressWorkout} />);
    
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toHaveClass('bg-yellow-100');

    const completedWorkout = createMockWorkout({ status: WorkoutStatus.COMPLETED });
    rerender(<WorkoutCard {...defaultProps} workout={completedWorkout} />);
    
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toHaveClass('bg-green-100');
  });

  it('shows workout stats when available', () => {
    const workout = createMockWorkout({
      totalVolume: 1500,
      totalTime: 45,
      sets: [
        { id: '1', exerciseId: 'ex1', setNumber: 1, completed: true },
        { id: '2', exerciseId: 'ex2', setNumber: 1, completed: true },
        { id: '3', exerciseId: 'ex3', setNumber: 1, completed: false },
      ],
    });

    render(<WorkoutCard {...defaultProps} workout={workout} />);

    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText('1,500 kg')).toBeInTheDocument();
    expect(screen.getByText('3 sets')).toBeInTheDocument();
  });

  it('calls onStart when start button is clicked', () => {
    const workout = createMockWorkout({ status: WorkoutStatus.PLANNED });
    render(<WorkoutCard {...defaultProps} workout={workout} />);

    fireEvent.click(screen.getByText('Start Workout'));
    expect(mockOnStart).toHaveBeenCalledWith(workout.id);
  });

  it('shows continue button for in-progress workouts', () => {
    const workout = createMockWorkout({ status: WorkoutStatus.IN_PROGRESS });
    render(<WorkoutCard {...defaultProps} workout={workout} />);

    expect(screen.getByText('Continue')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Continue'));
    expect(mockOnStart).toHaveBeenCalledWith(workout.id);
  });

  it('shows view button for completed workouts', () => {
    const workout = createMockWorkout({ status: WorkoutStatus.COMPLETED });
    render(<WorkoutCard {...defaultProps} workout={workout} />);

    expect(screen.getByText('View Details')).toBeInTheDocument();
    fireEvent.click(screen.getByText('View Details'));
    expect(mockOnEdit).toHaveBeenCalledWith(workout.id);
  });

  it('opens options menu when menu button is clicked', () => {
    render(<WorkoutCard {...defaultProps} />);

    fireEvent.click(screen.getByLabelText('Workout options'));
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls onEdit when edit option is selected', () => {
    render(<WorkoutCard {...defaultProps} />);

    fireEvent.click(screen.getByLabelText('Workout options'));
    fireEvent.click(screen.getByText('Edit'));
    expect(mockOnEdit).toHaveBeenCalledWith(defaultProps.workout.id);
  });

  it('calls onDelete when delete option is selected', () => {
    render(<WorkoutCard {...defaultProps} />);

    fireEvent.click(screen.getByLabelText('Workout options'));
    fireEvent.click(screen.getByText('Delete'));
    expect(mockOnDelete).toHaveBeenCalledWith(defaultProps.workout.id);
  });

  it('displays workout notes when available', () => {
    const workout = createMockWorkout({
      notes: 'Great workout today!',
    });
    render(<WorkoutCard {...defaultProps} workout={workout} />);

    expect(screen.getByText('Great workout today!')).toBeInTheDocument();
  });

  it('handles missing description gracefully', () => {
    const workout = createMockWorkout({
      name: 'No Description Workout',
      description: undefined,
    });
    render(<WorkoutCard {...defaultProps} workout={workout} />);

    expect(screen.getByText('No Description Workout')).toBeInTheDocument();
    expect(screen.queryByTestId('workout-description')).not.toBeInTheDocument();
  });

  it('formats date correctly for different formats', () => {
    const workout = createMockWorkout({
      date: '2023-12-25',
    });
    render(<WorkoutCard {...defaultProps} workout={workout} />);

    expect(screen.getByText('Dec 25, 2023')).toBeInTheDocument();
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<WorkoutCard {...defaultProps} />);

      expect(screen.getByLabelText('Workout options')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Start Workout' })).toBeInTheDocument();
    });

    it('supports keyboard navigation', () => {
      render(<WorkoutCard {...defaultProps} />);

      const startButton = screen.getByText('Start Workout');
      startButton.focus();
      expect(startButton).toHaveFocus();

      fireEvent.keyDown(startButton, { key: 'Enter' });
      expect(mockOnStart).toHaveBeenCalledWith(defaultProps.workout.id);
    });
  });

  describe('Edge Cases', () => {
    it('handles zero stats gracefully', () => {
      const workout = createMockWorkout({
        totalVolume: 0,
        totalTime: 0,
        sets: [],
      });
      render(<WorkoutCard {...defaultProps} workout={workout} />);

      expect(screen.getByText('0 min')).toBeInTheDocument();
      expect(screen.getByText('0 kg')).toBeInTheDocument();
      expect(screen.getByText('0 sets')).toBeInTheDocument();
    });

    it('handles large numbers correctly', () => {
      const workout = createMockWorkout({
        totalVolume: 15000,
        totalTime: 120,
      });
      render(<WorkoutCard {...defaultProps} workout={workout} />);

      expect(screen.getByText('120 min')).toBeInTheDocument();
      expect(screen.getByText('15,000 kg')).toBeInTheDocument();
    });
  });
});