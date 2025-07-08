import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'
import Field from '../models/field.model.js'

const User = sequelize.define('user', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isEmail: true
        }
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false
    },
    role: {
        type: DataTypes.ENUM('superadmin', 'admin', 'user'),
        defaultValue: 'admin',
        allowNull: false
    },
    field_id: {
        type: DataTypes.STRING,
        allowNull: true,
        references: {
            model: Field,
            key: 'field_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    }
}, {
    tableName: 'user',
    timestamps: false,
    underscored: true
})

export default User
