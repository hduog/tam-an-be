import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';

async function validateInput(input: Partial<RegisterDto>) {
  const dto = plainToInstance(RegisterDto, input);
  return validate(dto);
}

describe('RegisterDto', () => {
  it('input hợp lệ: không có lỗi validate', async () => {
    const errors = await validateInput({
      email: 'valid.user@tam-an.dev',
      password: 'Passw0rd123',
      display_name: 'Người dùng',
    });

    expect(errors).toHaveLength(0);
  });

  it('sai định dạng email: báo lỗi trên field email', async () => {
    const errors = await validateInput({
      email: 'not-an-email',
      password: 'Passw0rd123',
      display_name: 'Người dùng',
    });

    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('password quá yếu (thiếu chữ hoa/số, quá ngắn): báo lỗi trên field password', async () => {
    const errors = await validateInput({
      email: 'valid.user@tam-an.dev',
      password: 'weak',
      display_name: 'Người dùng',
    });

    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });

  it('display_name rỗng: báo lỗi trên field display_name', async () => {
    const errors = await validateInput({
      email: 'valid.user@tam-an.dev',
      password: 'Passw0rd123',
      display_name: '',
    });

    expect(errors.some((e) => e.property === 'display_name')).toBe(true);
  });
});
