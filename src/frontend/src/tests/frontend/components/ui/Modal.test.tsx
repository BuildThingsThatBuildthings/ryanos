import { render, screen, fireEvent, waitFor } from '../../../utils/test-utils';
import { Modal } from '../../../../components/ui/Modal';

describe('Modal Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Test Modal',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal when open', () => {
    render(
      <Modal {...defaultProps}>
        <p>Modal content</p>
      </Modal>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('does not render modal when closed', () => {
    render(
      <Modal {...defaultProps} isOpen={false}>
        <p>Modal content</p>
      </Modal>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <Modal {...defaultProps}>
        <p>Modal content</p>
      </Modal>
    );

    fireEvent.click(screen.getByLabelText('Close modal'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when escape key is pressed', () => {
    render(
      <Modal {...defaultProps}>
        <p>Modal content</p>
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    render(
      <Modal {...defaultProps}>
        <p>Modal content</p>
      </Modal>
    );

    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when modal content is clicked', () => {
    render(
      <Modal {...defaultProps}>
        <p>Modal content</p>
      </Modal>
    );

    fireEvent.click(screen.getByText('Modal content'));
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('renders without close button when showCloseButton is false', () => {
    render(
      <Modal {...defaultProps} showCloseButton={false}>
        <p>Modal content</p>
      </Modal>
    );

    expect(screen.queryByLabelText('Close modal')).not.toBeInTheDocument();
  });

  it('applies custom size classes', () => {
    render(
      <Modal {...defaultProps} size="large">
        <p>Modal content</p>
      </Modal>
    );

    const modalContent = screen.getByRole('dialog');
    expect(modalContent).toHaveClass('max-w-4xl');
  });

  it('traps focus within modal', async () => {
    render(
      <Modal {...defaultProps}>
        <input data-testid="first-input" />
        <input data-testid="second-input" />
      </Modal>
    );

    const firstInput = screen.getByTestId('first-input');
    const secondInput = screen.getByTestId('second-input');
    const closeButton = screen.getByLabelText('Close modal');

    // Focus should be trapped within modal
    firstInput.focus();
    expect(firstInput).toHaveFocus();

    // Tab should move to next focusable element
    fireEvent.keyDown(firstInput, { key: 'Tab' });
    await waitFor(() => expect(secondInput).toHaveFocus());

    // Tab should move to close button
    fireEvent.keyDown(secondInput, { key: 'Tab' });
    await waitFor(() => expect(closeButton).toHaveFocus());

    // Tab from last element should cycle back to first
    fireEvent.keyDown(closeButton, { key: 'Tab' });
    await waitFor(() => expect(firstInput).toHaveFocus());
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(
        <Modal {...defaultProps}>
          <p>Modal content</p>
        </Modal>
      );

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby');
    });

    it('focuses first focusable element on open', async () => {
      render(
        <Modal {...defaultProps}>
          <input data-testid="focus-target" />
        </Modal>
      );

      await waitFor(() => {
        expect(screen.getByTestId('focus-target')).toHaveFocus();
      });
    });

    it('restores focus to trigger element on close', async () => {
      const triggerButton = document.createElement('button');
      triggerButton.textContent = 'Open Modal';
      document.body.appendChild(triggerButton);
      triggerButton.focus();

      const { rerender } = render(
        <Modal {...defaultProps}>
          <p>Modal content</p>
        </Modal>
      );

      // Close modal
      rerender(
        <Modal {...defaultProps} isOpen={false}>
          <p>Modal content</p>
        </Modal>
      );

      await waitFor(() => {
        expect(triggerButton).toHaveFocus();
      });

      document.body.removeChild(triggerButton);
    });
  });

  describe('Animation', () => {
    it('applies enter animation classes', () => {
      render(
        <Modal {...defaultProps}>
          <p>Modal content</p>
        </Modal>
      );

      const backdrop = screen.getByTestId('modal-backdrop');
      expect(backdrop).toHaveClass('opacity-0');
      
      // Animation classes should be applied
      setTimeout(() => {
        expect(backdrop).toHaveClass('opacity-100');
      }, 100);
    });
  });
});